using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.DTOs;
using backend.Models;

namespace backend.Services;

public class RouteAssignmentService
{
    // Matches the role string used by ProfilesController and the "collector" JWT role.
    private const string CollectorRole = "collector";

    private readonly ApplicationDbContext _context;
    private readonly IRewardService _rewards;

    public RouteAssignmentService(ApplicationDbContext context, IRewardService rewards)
    {
        _context = context;
        _rewards = rewards;
    }

    /// <summary>
    /// How far back a pending stop is carried onto a collector's round.
    /// </summary>
    /// <remarks>
    /// A week. Past that it stops being a kerbside problem and becomes an office
    /// one: a stop nobody reached in seven days will not be reached by showing it
    /// again tomorrow, and by then the resident has usually rung in. What is
    /// needed is a person deciding -- reschedule, refuse, or apologise -- which a
    /// collector cannot do.
    ///
    /// Deliberately not an automatic Missed after N days. MarkMissed requires a
    /// reason, because "missed" with no explanation tells an admin nothing and
    /// cannot be answered to a resident; a timer writing "aged out" would poison
    /// the very field the Notifier agent reads to explain things to people.
    /// </remarks>
    public const int CarryForwardDays = 7;

    /// <summary>
    /// The round in front of the collector now.
    /// </summary>
    /// <remarks>
    /// Today's stops, plus anything older that is still pending.
    ///
    /// The carry-forward matters. This used to return the current day and
    /// nothing else, so a stop the crew never got to yesterday appeared on no
    /// screen at all the next morning: it was behind today, and
    /// GetUpcomingRouteForCollectorAsync starts at tomorrow. Nobody could
    /// complete it or report it, and the only way it surfaced again was the
    /// resident noticing and asking for another visit.
    ///
    /// Completed and missed stops are not carried, only pending ones. Those two
    /// are finished with; repeating them would grow the round a little longer
    /// every day.
    ///
    /// The carry-forward is capped at <see cref="CarryForwardDays"/>. Without a
    /// cap a stop nobody ever resolved stayed on the round for ever -- rounds
    /// were carrying stops from the month before -- and showing it again tomorrow
    /// was never going to get it collected. Past the cap it becomes an office
    /// problem: GetOverdueStopsAsync surfaces it for an admin to reassign or
    /// account for. Nothing vanishes; the responsibility moves to whoever can
    /// actually discharge it.
    /// </remarks>
    public async Task<List<RouteAssignmentDto>> GetTodayRouteForCollectorAsync(Guid collectorId)
    {
        var tomorrow = ServiceClock.TodayPlus(1);
        var carryFrom = ServiceClock.TodayPlus(-CarryForwardDays);

        var stops = await _context.RouteAssignments
            .AsNoTracking()
            .Include(r => r.PickupRequest)!
                .ThenInclude(p => p!.Resident)
            .Include(r => r.Zone)
            .Where(r => r.CollectorId == collectorId
                && r.ScheduledDate < tomorrow
                && (r.ScheduledDate >= ServiceClock.Today
                    || (r.CompletionStatus == RouteCompletionStatus.Pending
                        && r.ScheduledDate >= carryFrom)))
            // Oldest first, so anything carried over sits at the top of the
            // round rather than being buried among today's stops.
            .OrderBy(r => r.ScheduledDate)
            .Select(r => MapToDto(r))
            .ToListAsync();

        await AttachCategoriesAsync(stops);
        return stops;
    }

    /// <summary>
    /// Pending stops too old to still be on a collector's round.
    /// </summary>
    /// <remarks>
    /// The other half of the carry-forward cap. A stop drops off the round after
    /// <see cref="CarryForwardDays"/> days, and lands here instead, so it is
    /// still somebody's problem -- just the right somebody. An admin can reassign
    /// it to a collector who will reach it, or mark it missed with a reason the
    /// resident can be told.
    ///
    /// Across every collector, oldest first: this is a queue to be emptied, and
    /// the stop that has waited longest is the one a resident is most likely to
    /// be ringing about.
    /// </remarks>
    public async Task<List<RouteAssignmentDto>> GetOverdueStopsAsync()
    {
        var before = ServiceClock.TodayPlus(-CarryForwardDays);

        var stops = await _context.RouteAssignments
            .AsNoTracking()
            .Include(r => r.PickupRequest)!
                .ThenInclude(p => p!.Resident)
            .Include(r => r.Zone)
            .Where(r => r.CompletionStatus == RouteCompletionStatus.Pending
                && r.ScheduledDate < before)
            .OrderBy(r => r.ScheduledDate)
            .Select(r => MapToDto(r))
            .ToListAsync();

        await AttachCategoriesAsync(stops);
        return stops;
    }

    /// <summary>
    /// A collector's stops scheduled after today, so they can see what is coming
    /// rather than only the current day.
    /// </summary>
    /// <param name="days">
    /// How far ahead to look, counted from tomorrow. Clamped to 1..30: a
    /// collector plans days ahead, not months, and an unbounded range would let
    /// one request walk the whole table.
    /// </param>
    public async Task<List<RouteAssignmentDto>> GetUpcomingRouteForCollectorAsync(Guid collectorId, int days = 7)
    {
        var from = ServiceClock.TodayPlus(1);
        var to = from.AddDays(Math.Clamp(days, 1, 30));

        var stops = await _context.RouteAssignments
            .AsNoTracking()
            .Include(r => r.PickupRequest)!
                .ThenInclude(p => p!.Resident)
            .Include(r => r.Zone)
            .Where(r => r.CollectorId == collectorId
                && r.ScheduledDate >= from
                && r.ScheduledDate < to)
            .OrderBy(r => r.ScheduledDate)
            .Select(r => MapToDto(r))
            .ToListAsync();

        await AttachCategoriesAsync(stops);
        return stops;
    }

    /// <summary>
    /// Books a stop, after checking that everything it points at exists and is
    /// fit to be pointed at.
    /// </summary>
    /// <remarks>
    /// This checked nothing at all. An admin could book a stop against a pickup
    /// that did not exist, a zone that had been retired, or a resident's profile
    /// id in place of a collector's -- the last of which puts the round on a
    /// screen that nobody drives. The database's foreign keys caught the
    /// non-existent ids as a 500; the wrong-role one it accepted happily.
    ///
    /// Thrown as ArgumentException because the caller maps that to a 400 with the
    /// message, which is what an admin needs to see rather than "an error
    /// occurred".
    /// </remarks>
    public async Task<RouteAssignmentDto> CreateAsync(CreateRouteAssignmentDto dto)
    {
        var pickupExists = await _context.PickupRequests
            .AnyAsync(p => p.Id == dto.PickupRequestId);
        if (!pickupExists)
            throw new ArgumentException("That pickup request no longer exists.");

        await EnsureIsCollectorAsync(dto.CollectorId);

        var zone = await _context.Zones
            .AsNoTracking()
            .FirstOrDefaultAsync(z => z.Id == dto.ZoneId);
        if (zone is null)
            throw new ArgumentException("That zone no longer exists.");
        if (!zone.IsActive)
            throw new ArgumentException(
                $"{zone.Name} has been retired, so stops cannot be booked in it.");

        // One pending stop per pickup. Booking a second put the same collection
        // on the round twice, and completing one left the other to be carried
        // forward for ever as work that had in fact been done.
        var alreadyBooked = await _context.RouteAssignments
            .AnyAsync(r => r.PickupRequestId == dto.PickupRequestId
                && r.CompletionStatus == RouteCompletionStatus.Pending);
        if (alreadyBooked)
            throw new ArgumentException(
                "That pickup is already on a round. Reassign or report the existing stop instead.");

        var route = new RouteAssignment
        {
            PickupRequestId = dto.PickupRequestId,
            CollectorId = dto.CollectorId,
            ZoneId = dto.ZoneId,
            ScheduledDate = dto.ScheduledDate,
            CompletionStatus = RouteCompletionStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.RouteAssignments.Add(route);
        await MarkPickupScheduledAsync(dto.PickupRequestId);
        await _context.SaveChangesAsync();

        return MapToDto(route);
    }

    /// <summary>
    /// Moves a pickup to Scheduled once it has a collector.
    /// </summary>
    /// <remarks>
    /// Both agent paths already do this when they add an assignment
    /// (ApprovalService and PickupRequestService); the two manual paths did not,
    /// so a pickup routed by hand kept its old status and stayed under the wrong
    /// filter on the requests list for ever.
    ///
    /// Completed is left alone: a pickup that has already been collected must
    /// not be walked backwards by a late assignment.
    /// </remarks>
    private async Task MarkPickupScheduledAsync(Guid pickupRequestId)
    {
        var pickup = await _context.PickupRequests
            .FirstOrDefaultAsync(p => p.Id == pickupRequestId);

        if (pickup is null || pickup.Status == PickupStatus.Completed)
        {
            return;
        }

        pickup.Status = PickupStatus.Scheduled;
    }

    public async Task<RouteAssignmentDto?> MarkCompleteAsync(Guid id, string? issueNotes = null)
    {
        var route = await _context.RouteAssignments.FirstOrDefaultAsync(r => r.Id == id);
        if (route is null)
        {
            return null;
        }

        // Already collected: nothing to redo, and the first completion's time
        // and notes stay as they were recorded.
        if (route.CompletionStatus == RouteCompletionStatus.Completed)
        {
            return MapToDto(route);
        }

        route.CompletionStatus = RouteCompletionStatus.Completed;
        route.CompletedAt = DateTime.UtcNow;
        route.IssueNotes = issueNotes;
        route.UpdatedAt = DateTime.UtcNow;

        // Collected: close the pickup and pay the resident in the same save,
        // so a completed pickup can never be left without its points.
        var pickup = await _context.PickupRequests.FirstOrDefaultAsync(p => p.Id == route.PickupRequestId);
        PickupRequest? nextOccurrence = null;
        if (pickup is not null)
        {
            pickup.Status = PickupStatus.Completed;
            await _rewards.StageCompletionAwardAsync(pickup.Id);
            nextOccurrence = BuildNextOccurrence(pickup);
            if (nextOccurrence is not null) _context.PickupRequests.Add(nextOccurrence);
        }

        await _context.SaveChangesAsync();

        NextRecurringPickupId = nextOccurrence?.Id;
        return MapToDto(route);
    }

    /// <summary>
    /// Every stop scheduled on one day, across all collectors, for the admin.
    /// </summary>
    /// <remarks>
    /// The per-collector endpoints answer "what am I doing today"; this answers
    /// "what is happening today", which is what an admin needs in order to spot
    /// a stop nobody closed off.
    /// </remarks>
    /// <param name="date">The day to report on, in UTC. Defaults to today.</param>
    public async Task<List<RouteAssignmentDto>> GetAssignmentsForDayAsync(DateTime? date = null)
    {
        // Kind matters here. ScheduledDate is "timestamp with time zone", and
        // Npgsql refuses a DateTime whose Kind is Unspecified -- which is
        // exactly what model binding produces from ?date=2026-10-02. Without
        // this the query throws the moment a date is supplied, and the caller
        // sees an empty table rather than an error.
        // No date means today, read the same way everything else reads it.
        var from = date is null ? ServiceClock.Today : ServiceClock.AsServiceDay(date.Value);
        var to = from.AddDays(1);

        var stops = await _context.RouteAssignments
            .AsNoTracking()
            .Include(r => r.PickupRequest)!
                .ThenInclude(p => p!.Resident)
            .Include(r => r.Zone)
            .Where(r => r.ScheduledDate >= from && r.ScheduledDate < to)
            .OrderBy(r => r.ScheduledDate)
            .Select(r => MapToDto(r))
            .ToListAsync();

        await AttachCategoriesAsync(stops);
        return stops;
    }

    /// <summary>
    /// Records that a stop was not collected. Admin-only: a collector marks work
    /// done, an admin accounts for work that was not.
    /// </summary>
    /// <remarks>
    /// Nothing else in the system writes Missed, so without this the status
    /// existed on the enum and in every count but could never occur.
    ///
    /// Only a pending stop can be missed. Re-marking a completed one would
    /// silently erase its CompletedAt, so that is refused rather than accepted.
    /// </remarks>
    /// <returns>Null when no such stop exists; the updated stop once missed.</returns>
    /// <summary>
    /// The id of the pickup created by the last MarkCompleteAsync call, when
    /// that pickup was recurring. Null otherwise.
    /// </summary>
    /// <remarks>
    /// The caller needs it to book the new occurrence onto a round, which takes
    /// an agent call and so must not happen inside the collector's save.
    /// </remarks>
    public Guid? NextRecurringPickupId { get; private set; }

    /// <summary>
    /// The next occurrence of a recurring collection, or null if there is none.
    /// </summary>
    /// <remarks>
    /// Created when a collection actually happens rather than by a nightly job.
    /// That needs no scheduler, and it has a property worth keeping: the chain
    /// continues only while collections are really being made, so a resident who
    /// stops putting bins out does not accumulate a queue of phantom pickups.
    ///
    /// The photo is deliberately not copied -- it showed last fortnight's
    /// rubbish, and the classifier would be reading a stale picture.
    /// </remarks>
    private static PickupRequest? BuildNextOccurrence(PickupRequest pickup)
    {
        if (!pickup.IsRecurring) return null;

        var interval = (pickup.RecurrenceInterval ?? string.Empty).Trim().ToLowerInvariant();
        var days = interval switch
        {
            "weekly" => 7,
            "bi-weekly" or "biweekly" or "fortnightly" => 14,
            _ => 0
        };

        if (days == 0) return null;

        return new PickupRequest
        {
            ResidentId = pickup.ResidentId,
            ZoneId = pickup.ZoneId,
            Address = pickup.Address,
            ContactPhone = pickup.ContactPhone,
            Latitude = pickup.Latitude,
            Longitude = pickup.Longitude,
            Description = pickup.Description,
            PreferredDate = ServiceClock.TodayPlus(days),
            IsRecurring = true,
            RecurrenceInterval = pickup.RecurrenceInterval,
            IsBulkRequest = false,
            Status = PickupStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>Whether this stop belongs to the given collector's round.</summary>
    public Task<bool> IsAssignedToAsync(Guid routeId, Guid collectorId)
        => _context.RouteAssignments
            .AsNoTracking()
            .AnyAsync(r => r.Id == routeId && r.CollectorId == collectorId);

    public async Task<RouteAssignmentDto?> MarkMissedAsync(Guid id, string? issueNotes = null)
    {
        var route = await _context.RouteAssignments.FirstOrDefaultAsync(r => r.Id == id);
        if (route is null)
        {
            return null;
        }

        if (route.CompletionStatus == RouteCompletionStatus.Completed)
        {
            throw new InvalidOperationException(
                "This stop is already completed, so it cannot be marked missed.");
        }

        // A reason is required, and only the server can insist on it. Both UIs ask
        // for one, but the endpoint accepted an empty body -- and the Notifier
        // agent writes the resident's explanation from this field, so a blank
        // report produced "your collection was missed" with nothing after it.
        var reason = issueNotes?.Trim();
        if (string.IsNullOrEmpty(reason))
        {
            throw new ArgumentException(
                "Say why it could not be collected. The resident is told this.");
        }
        if (reason.Length > 500)
        {
            throw new ArgumentException(
                "The reason must be 500 characters or fewer.");
        }

        route.CompletionStatus = RouteCompletionStatus.Missed;
        route.CompletedAt = null;
        route.IssueNotes = reason;
        route.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToDto(route);
    }

    /// <summary>
    /// Moves a stop to another collector.
    /// </summary>
    /// <remarks>
    /// The new collector is checked for the same reason as on create: this
    /// accepted any id, including a resident's, which quietly moved the stop onto
    /// a round nobody drives.
    ///
    /// Only a pending stop can be moved. Reassigning a completed one rewrote who
    /// is recorded as having collected it, which is a falsified record rather than
    /// a plan; a missed one is finished with too, and the pickup is rebooked as
    /// its own new stop.
    /// </remarks>
    public async Task<RouteAssignmentDto?> ReassignAsync(Guid id, Guid newCollectorId)
    {
        var route = await _context.RouteAssignments.FirstOrDefaultAsync(r => r.Id == id);
        if (route is null)
        {
            return null;
        }

        if (route.CompletionStatus != RouteCompletionStatus.Pending)
            throw new InvalidOperationException(
                $"This stop is already marked {route.CompletionStatus.ToString().ToLowerInvariant()}, "
                + "so it cannot be reassigned.");

        if (route.CollectorId == newCollectorId)
            throw new InvalidOperationException(
                "That collector already has this stop.");

        await EnsureIsCollectorAsync(newCollectorId);

        route.CollectorId = newCollectorId;
        route.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToDto(route);
    }

    /// <summary>
    /// Load per collector, including collectors who have never been assigned anything.
    /// </summary>
    /// <remarks>
    /// Driven from the collector list rather than from RouteAssignments. Grouping
    /// the assignments alone silently omits any collector with no rows -- and an
    /// idle collector is exactly the one a load balancer most needs to see, so
    /// the omission biased every routing decision away from them.
    /// </remarks>
    public async Task<List<CollectorLoadDto>> GetLoadReportAsync()
    {
        return await _context.Profiles
            .AsNoTracking()
            .Where(p => p.Role == CollectorRole)
            .Select(p => new CollectorLoadDto
            {
                CollectorId = p.Id,
                TotalAssignments = _context.RouteAssignments
                    .Count(r => r.CollectorId == p.Id),
                PendingAssignments = _context.RouteAssignments
                    .Count(r => r.CollectorId == p.Id && r.CompletionStatus == RouteCompletionStatus.Pending),
                CompletedAssignments = _context.RouteAssignments
                    .Count(r => r.CollectorId == p.Id && r.CompletionStatus == RouteCompletionStatus.Completed),
                MissedAssignments = _context.RouteAssignments
                    .Count(r => r.CollectorId == p.Id && r.CompletionStatus == RouteCompletionStatus.Missed)
            })
            .ToListAsync();
    }

    /// <summary>
    /// Pickup counts per zone, for the admin zone cards.
    /// </summary>
    /// <remarks>
    /// Driven from the zone list so a zone with no assignments still appears,
    /// reporting zeroes rather than vanishing.
    /// </remarks>
    public async Task<List<ZoneLoadDto>> GetZoneLoadReportAsync()
    {
        var today = ServiceClock.Today;
        var tomorrow = today.AddDays(1);

        return await _context.Zones
            .AsNoTracking()
            .OrderBy(z => z.Name)
            .Select(z => new ZoneLoadDto
            {
                ZoneId = z.Id,
                ZoneName = z.Name,
                PendingAssignments = _context.RouteAssignments
                    .Count(r => r.ZoneId == z.Id && r.CompletionStatus == RouteCompletionStatus.Pending),
                DueToday = _context.RouteAssignments
                    .Count(r => r.ZoneId == z.Id
                                && r.CompletionStatus == RouteCompletionStatus.Pending
                                && r.ScheduledDate >= today && r.ScheduledDate < tomorrow),
                CompletedAssignments = _context.RouteAssignments
                    .Count(r => r.ZoneId == z.Id && r.CompletionStatus == RouteCompletionStatus.Completed),
                MissedAssignments = _context.RouteAssignments
                    .Count(r => r.ZoneId == z.Id && r.CompletionStatus == RouteCompletionStatus.Missed),
                TotalAssignments = _context.RouteAssignments.Count(r => r.ZoneId == z.Id),
            })
            .ToListAsync();
    }

    public async Task<RouteAssignmentDto?> AssignPickupToRouteAsync(Guid pickupRequestId)
    {
        var pickup = await _context.PickupRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == pickupRequestId);
        if (pickup is null)
        {
            return null;
        }

        // Route to the zone the pickup is actually in. This used to take the
        // first active zone with a collector, which sent a Dehiwala pickup to
        // whichever collector the database happened to return first -- and with
        // no OrderBy, that could differ between two identical calls.
        if (pickup.ZoneId is null)
        {
            throw new InvalidOperationException(
                "This pickup has no zone, so a collector cannot be chosen. Assign a zone and retry.");
        }

        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == pickup.ZoneId.Value && z.IsActive);
        if (zone is null)
        {
            throw new InvalidOperationException(
                "The pickup's zone is inactive or no longer exists, so it cannot be scheduled.");
        }

        // The same guard CreateAsync applies, and for the same reason. This path
        // did not have it: the Assign button on the pickups list is one click, and
        // clicking it twice -- or two admins clicking it at once -- put the same
        // collection on the round twice. Completing one then left the other to be
        // carried forward for ever as work that had in fact been done.
        var alreadyBooked = await _context.RouteAssignments
            .AnyAsync(r => r.PickupRequestId == pickupRequestId
                && r.CompletionStatus == RouteCompletionStatus.Pending);
        if (alreadyBooked)
        {
            throw new InvalidOperationException(
                "That pickup is already on a round.");
        }

        // The zone's own collector is the default. When the zone has none, fall
        // back to the least-loaded collector by pending work, which is the same
        // basis the agent router uses.
        var collectorId = zone.AssignedCollectorId ?? await LeastLoadedCollectorIdAsync();
        if (collectorId is null)
        {
            throw new InvalidOperationException(
                "No collector is assigned to this zone and no other collector is available.");
        }

        var route = new RouteAssignment
        {
            PickupRequestId = pickupRequestId,
            ZoneId = zone.Id,
            CollectorId = collectorId.Value,
            // Today, not tomorrow: an admin assigning a pickup expects it on
            // the collector's screen now, and GetTodayRouteForCollectorAsync
            // only returns the current service day.
            ScheduledDate = ServiceClock.Today,
            CompletionStatus = RouteCompletionStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.RouteAssignments.Add(route);
        await MarkPickupScheduledAsync(pickupRequestId);
        await _context.SaveChangesAsync();

        return MapToDto(route);
    }

    /// <summary>
    /// The collector carrying the fewest pending stops, or null when there are
    /// no collectors at all. Ties break on the smallest id so the same input
    /// gives the same answer twice.
    /// </summary>
    private async Task<Guid?> LeastLoadedCollectorIdAsync()
    {
        var candidates = await _context.Profiles
            .AsNoTracking()
            .Where(p => p.Role == CollectorRole)
            .Select(p => new
            {
                p.Id,
                Pending = _context.RouteAssignments
                    .Count(r => r.CollectorId == p.Id && r.CompletionStatus == RouteCompletionStatus.Pending)
            })
            .ToListAsync();

        return candidates
            .OrderBy(c => c.Pending)
            .ThenBy(c => c.Id)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefault();
    }

    /// <summary>
    /// Fills in each stop's waste category from the pickup's latest classification.
    /// </summary>
    /// <remarks>
    /// A second query rather than a join: the category lives on
    /// WasteClassifications, PickupRequest has no navigation to them, and adding
    /// one only to read it back would change the model for no schema gain.
    ///
    /// One round trip for the whole list, keyed by pickup id, so a round of
    /// thirty stops still costs two queries rather than thirty-one.
    /// </remarks>
    private async Task AttachCategoriesAsync(List<RouteAssignmentDto> stops)
    {
        if (stops.Count == 0) return;

        var pickupIds = stops.Select(s => s.PickupRequestId).Distinct().ToList();

        var latest = await _context.WasteClassifications
            .AsNoTracking()
            .Where(c => pickupIds.Contains(c.PickupRequestId))
            // Newest first, so the first row per pickup is the one that counts.
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new { c.PickupRequestId, c.Category, c.Confidence })
            .ToListAsync();

        var byPickup = latest
            .GroupBy(c => c.PickupRequestId)
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var stop in stops)
        {
            if (!byPickup.TryGetValue(stop.PickupRequestId, out var c)) continue;
            stop.Category = c.Category.ToString();
            stop.Confidence = c.Confidence;
        }
    }

    /// <summary>
    /// Refuses an id that is not a collector's.
    /// </summary>
    /// <remarks>
    /// The role is checked, not merely the existence of the profile. Every id in
    /// this system is a profiles row, so a resident's id is a perfectly valid
    /// foreign key -- the database cannot tell the difference, and a round
    /// assigned to a resident appears on no collector's screen and is never
    /// driven.
    /// </remarks>
    private async Task EnsureIsCollectorAsync(Guid collectorId)
    {
        var role = await _context.Profiles
            .AsNoTracking()
            .Where(p => p.Id == collectorId)
            .Select(p => p.Role)
            .FirstOrDefaultAsync();

        if (role is null)
            throw new ArgumentException("That collector no longer exists.");

        if (!string.Equals(role, "collector", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException(
                "Stops can only be assigned to a collector.");
    }

    private static RouteAssignmentDto MapToDto(RouteAssignment route) => new()
    {
        Id = route.Id,
        PickupRequestId = route.PickupRequestId,
        CollectorId = route.CollectorId,
        ZoneId = route.ZoneId,
        ScheduledDate = route.ScheduledDate,
        CompletionStatus = route.CompletionStatus,
        CompletedAt = route.CompletedAt,
        IssueNotes = route.IssueNotes,
        UpdatedAt = route.UpdatedAt,
        CreatedAt = route.CreatedAt,

        // Null unless the caller included the navigations. The three list
        // queries do; the write paths return ids only, and every client reloads
        // the round after a write, so the detail arrives with that.
        ResidentName = route.PickupRequest?.Resident?.FullName,
        ResidentPhone = route.PickupRequest?.ContactPhone,
        Address = route.PickupRequest?.Address,
        Latitude = route.PickupRequest?.Latitude,
        Longitude = route.PickupRequest?.Longitude,
        Description = route.PickupRequest?.Description,
        ZoneName = route.Zone?.Name,
        ZoneLatitude = route.Zone?.Latitude,
        ZoneLongitude = route.Zone?.Longitude,
        IsBulkRequest = route.PickupRequest?.IsBulkRequest ?? false,
        PhotoUrl = route.PickupRequest?.PhotoUrl,
        RequestedAt = route.PickupRequest?.CreatedAt,
        Pickup = route.PickupRequest is { } p ? new RoutePickupDto
        {
            Id = p.Id,
            Address = p.Address,
            Latitude = p.Latitude,
            Longitude = p.Longitude,
            Description = p.Description,
            PhotoUrl = p.PhotoUrl,
            ZoneName = route.Zone?.Name,
            ZoneId = p.ZoneId
        } : null
    };
}
