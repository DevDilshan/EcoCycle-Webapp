using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.Models;

namespace backend.Services;

/// <summary>
/// Finds a new slot for a pickup that is already classified.
/// </summary>
/// <remarks>
/// Three things need this and none of them need classifying again: a stop the
/// collector missed, a resident asking for a second attempt, and the next
/// occurrence of a recurring collection. Re-running the whole pipeline for those
/// would re-read a photo that has not changed and pay for a vision call to learn
/// what is already known.
/// </remarks>
public class PickupSchedulingService
{
    private readonly ApplicationDbContext _db;
    private readonly IAgentPipelineClient _agents;
    private readonly RoutingOptionBuilder _routingOptions;
    private readonly ILogger<PickupSchedulingService> _logger;

    public PickupSchedulingService(
        ApplicationDbContext db,
        IAgentPipelineClient agents,
        RoutingOptionBuilder routingOptions,
        ILogger<PickupSchedulingService> logger)
    {
        _db = db;
        _agents = agents;
        _routingOptions = routingOptions;
        _logger = logger;
    }

    /// <summary>
    /// Books a pickup onto a collector's round again.
    /// </summary>
    /// <returns>
    /// Null on success; otherwise a reason an admin can act on. Failing is not
    /// an exception: "every truck is full for two weeks" is a real answer, and
    /// the pickup is simply left for someone to place by hand.
    /// </returns>
    public async Task<string?> ScheduleAsync(Guid pickupRequestId)
    {
        var pickup = await _db.PickupRequests
            .FirstOrDefaultAsync(p => p.Id == pickupRequestId);

        if (pickup is null) return "That pickup no longer exists.";
        if (pickup.ZoneId is null) return "This pickup has no zone, so a collector cannot be chosen.";

        // Never book the same pickup twice onto an open stop -- but only a stop
        // that is still ahead counts as booked.
        //
        // This used to refuse on any pending stop at all, which made the
        // resident's "it wasn't collected" button refuse the one case it exists
        // for: a stop whose day went by with nobody marking it either way is
        // pending and overdue, so the button was offered and then answered with
        // "this pickup is already booked onto a collector's round".
        var tomorrow = ServiceClock.TodayPlus(1);

        var openStops = await _db.RouteAssignments
            .Where(r => r.PickupRequestId == pickup.Id
                && r.CompletionStatus == RouteCompletionStatus.Pending)
            .ToListAsync();

        if (openStops.Any(r => r.ScheduledDate >= ServiceClock.Today))
        {
            return "This pickup is already booked onto a collector's round.";
        }

        // Anything left is a stop whose day has passed and which nobody closed
        // off. Releasing it keeps the pickup on exactly one round: without this
        // the stale stop would stay on the collector's screen alongside the new
        // booking, and the same waste would be waiting for two different crews.
        var stale = openStops.Where(r => r.ScheduledDate < tomorrow).ToList();
        if (stale.Count > 0)
        {
            _db.RouteAssignments.RemoveRange(stale);
            _logger.LogInformation(
                "Releasing {Count} overdue stop(s) for pickup {PickupId} before rebooking it.",
                stale.Count, pickup.Id);
        }

        var category = await LatestCategoryAsync(pickup.Id);
        var context = await _routingOptions.BuildAsync(pickup.ZoneId.Value, category, pickup.PreferredDate);

        if (context.Options.Count == 0)
        {
            return "No collector equipped for this pickup has a free slot in the next two weeks.";
        }

        RoutingDtoResult result;
        try
        {
            var routing = await _agents.ChooseSlotAsync(context);
            if (routing is null) return "The agent service is unavailable, so no slot could be chosen.";
            result = new RoutingDtoResult(routing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Choosing a slot failed for pickup {PickupId}.", pickup.Id);
            return "The agent service rejected the request, so no slot could be chosen.";
        }

        if (!AgentRoutingMapper.TryBuild(
                pickup.Id, pickup.ZoneId.Value, result.Routing, out var assignment, out var error))
        {
            return error;
        }

        // The slots were filtered by vehicle before the agent saw them, but the
        // check is repeated here: this is the last point before a collector is
        // sent somewhere, and the cost of being wrong is a crew turning up
        // unable to take the load.
        if (!await VehicleCanCarryAsync(assignment!.CollectorId, category))
        {
            return "The chosen collector's vehicle cannot carry this category.";
        }

        _db.RouteAssignments.Add(assignment);
        pickup.Status = PickupStatus.Scheduled;
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Pickup {PickupId} rescheduled to collector {CollectorId} on {Date}.",
            pickup.Id, assignment.CollectorId, assignment.ScheduledDate);

        return null;
    }

    /// <summary>
    /// Stores the resident-facing explanation of a failed collection.
    /// </summary>
    /// <remarks>
    /// Best-effort on purpose. The collector's report and the rebooking are the
    /// things that matter; if the agent is down, the resident still sees the
    /// status and the new date, just in the crew's own words rather than in a
    /// sentence written for them.
    /// </remarks>
    public async Task WriteResidentMessageAsync(Guid pickupRequestId, string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason)) return;

        var pickup = await _db.PickupRequests.FirstOrDefaultAsync(p => p.Id == pickupRequestId);
        if (pickup is null) return;

        var nextVisit = await _db.RouteAssignments
            .AsNoTracking()
            .Where(r => r.PickupRequestId == pickupRequestId
                && r.CompletionStatus == RouteCompletionStatus.Pending)
            .OrderBy(r => r.ScheduledDate)
            .Select(r => (DateTime?)r.ScheduledDate)
            .FirstOrDefaultAsync();

        try
        {
            var written = await _agents.ExplainMissedAsync(new DTOs.ExplainMissedRequestDto
            {
                Reason = reason,
                Description = pickup.Description ?? string.Empty,
                NextVisit = nextVisit?.ToString("yyyy-MM-dd")
            });

            if (written is null || string.IsNullOrWhiteSpace(written.ResidentMessage)) return;

            pickup.ResidentMessage = written.ResidentMessage.Length > 1000
                ? written.ResidentMessage[..1000]
                : written.ResidentMessage;

            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Could not write the resident message for pickup {PickupId}; the status and " +
                "the collector's own note still stand.", pickupRequestId);
        }
    }

    private async Task<WasteCategory> LatestCategoryAsync(Guid pickupRequestId)
    {
        var category = await _db.WasteClassifications
            .AsNoTracking()
            .Where(w => w.PickupRequestId == pickupRequestId)
            .OrderByDescending(w => w.CreatedAt)
            .Select(w => (WasteCategory?)w.Category)
            .FirstOrDefaultAsync();

        // Unclassified pickups are treated as ordinary waste, which only widens
        // the slots offered; the vehicle check below still applies.
        return category ?? WasteCategory.General;
    }

    private async Task<bool> VehicleCanCarryAsync(Guid collectorId, WasteCategory category)
    {
        if (category is not (WasteCategory.Bulk or WasteCategory.Hazardous)) return true;

        var setting = await _db.CollectorSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CollectorId == collectorId);

        return category == WasteCategory.Bulk
            ? setting?.HandlesBulky ?? CollectorSettingService.DefaultSetting.HandlesBulky
            : setting?.HandlesHazardous ?? CollectorSettingService.DefaultSetting.HandlesHazardous;
    }

    /// <summary>Wrapper so the routing result reads clearly at the call site.</summary>
    private readonly record struct RoutingDtoResult(DTOs.RoutingDto Routing);
}
