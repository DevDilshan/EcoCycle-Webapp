using System.Text.Json;
using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class ApprovalService : IApprovalService
{
    private readonly ApplicationDbContext _db;
    private readonly IAgentPipelineClient _agents;
    private readonly RouteAssignmentService _routes;
    private readonly RoutingOptionBuilder _routingOptions;
    private readonly ILogger<ApprovalService> _logger;

    public ApprovalService(
        ApplicationDbContext db,
        IAgentPipelineClient agents,
        RouteAssignmentService routes,
        RoutingOptionBuilder routingOptions,
        ILogger<ApprovalService> logger)
    {
        _db = db;
        _agents = agents;
        _routes = routes;
        _routingOptions = routingOptions;
        _logger = logger;
    }

    public async Task<PagedResult<ApprovalResponseDto>> GetListAsync(ApprovalQueryParams query)
    {
        var q = _db.ApprovalRequests.AsNoTracking().AsQueryable();

        if (query.Status.HasValue)
            q = q.Where(a => a.Status == query.Status.Value);

        q = q.OrderByDescending(a => a.CreatedAt);

        var total = await q.CountAsync();
        var entities = await q
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        var items = entities.Select(ToDto).ToList();

        return new PagedResult<ApprovalResponseDto>
        {
            Items = items,
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = total,
        };
    }

    public async Task<ApprovalDetailDto?> GetByIdAsync(Guid id)
    {
        var entity = await _db.ApprovalRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (entity is null) return null;

        var detail = new ApprovalDetailDto
        {
            Id = entity.Id,
            PickupRequestId = entity.PickupRequestId,
            FlagReason = entity.FlagReason,
            Status = entity.Status.ToString(),
            ReviewedByAdminId = entity.ReviewedByAdminId,
            ReviewNotes = entity.ReviewNotes,
            ReviewedAt = entity.ReviewedAt,
            CreatedAt = entity.CreatedAt
        };

        if (string.IsNullOrWhiteSpace(entity.PipelineResultJson))
        {
            detail.AgentResultNote =
                "This request was flagged before the agent pipeline existed, so there is no " +
                "classification to show.";
            return detail;
        }

        try
        {
            var result = JsonSerializer.Deserialize<PipelineResultDto>(
                entity.PipelineResultJson, AgentJson.Options);

            if (result is null)
            {
                detail.AgentResultNote = "The stored agent result was empty.";
                return detail;
            }

            detail.AgentInsight = new AgentInsightDto
            {
                Category = result.Classification.Category,
                Confidence = result.Classification.Confidence,
                ClassificationReasoning = result.Classification.Reasoning,
                ImageUsed = result.Classification.ImageUsed,
                ViolatedRules = result.Validation.ViolatedRules,
                PolicyLlmReasoning = result.Validation.LlmReview is { Skipped: false } review
                    ? review.Reasoning
                    : null,
                Recommendation = result.Approval?.Recommendation,
                AdminSummary = result.Approval?.AdminSummary,
                ResidentNotification = result.Approval?.ResidentNotification,
                RecommendationReasoning = result.Approval?.Reasoning
            };
        }
        catch (JsonException ex)
        {
            // Never fail the review screen over a bad blob: the admin can still
            // act on FlagReason alone, which is stored as plain text.
            _logger.LogError(ex, "Stored pipeline result for approval {ApprovalId} is not valid JSON.", entity.Id);
            detail.AgentResultNote = "The stored agent result could not be read.";
        }

        return detail;
    }

    public async Task<ApprovalResponseDto?> ApproveAsync(Guid id, Guid adminId, ApproveApprovalDto dto)
    {
        var entity = await _db.ApprovalRequests
            .Include(a => a.PickupRequest)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (entity is null) return null;
        if (entity.Status != ApprovalStatus.Pending)
            throw new InvalidOperationException("Only pending approval requests can be approved.");

        entity.Status = ApprovalStatus.Approved;
        entity.ReviewedByAdminId = adminId;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewNotes = dto.Notes?.Trim();

        if (entity.PickupRequest is not null)
        {
            entity.PickupRequest.Status = PickupStatus.Approved;

            // Approving a bulky pickup spends a bulky slot. Without this the
            // admin's decision is forgotten: the collection happens, the
            // allowance still reads untouched, and the same resident is flagged
            // again next week for the same reason.
            if (await IsBulkAsync(entity.PickupRequestId))
            {
                entity.PickupRequest.IsBulkRequest = true;
            }
        }

        // The approval is committed before routing is attempted. An admin's
        // decision must not be lost because the agent service is having a bad
        // day -- a pickup left Approved but unassigned is recoverable, an
        // approval that silently failed to save is not.
        await _db.SaveChangesAsync();

        var routingWarning = await TryRouteApprovedPickupAsync(entity);

        await WriteDecisionMessageAsync(
            entity,
            approved: true,
            reason: dto.Notes ?? entity.FlagReason);

        var response = ToDto(entity);
        response.RoutingWarning = routingWarning;
        return response;
    }

    /// <summary>
    /// Assigns a collector to a pickup that has just been approved.
    /// </summary>
    /// <returns>
    /// Null when the pickup was scheduled; otherwise an admin-readable reason it
    /// was not, so the caller can surface a retry rather than reporting success.
    /// </returns>
    private async Task<string?> TryRouteApprovedPickupAsync(ApprovalRequest entity)
    {
        var pickup = entity.PickupRequest;

        if (pickup is null)
            return "The approval has no pickup request attached, so it could not be scheduled.";

        if (pickup.ZoneId is null)
            return "This pickup has no zone, so a collector could not be chosen. Assign a zone and retry.";

        if (string.IsNullOrWhiteSpace(entity.PipelineResultJson))
            return "This approval has no stored agent result (it predates the agent pipeline), " +
                   "so it must be assigned to a collector manually.";

        if (await _db.RouteAssignments.AnyAsync(r => r.PickupRequestId == pickup.Id))
            return "This pickup already has a collector assigned.";

        JsonDocument storedResult;
        try
        {
            storedResult = JsonDocument.Parse(entity.PipelineResultJson);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Stored pipeline result for approval {ApprovalId} is not valid JSON.", entity.Id);
            return "The stored agent result could not be read, so this pickup must be assigned manually.";
        }

        RoutingDto? routing;
        try
        {
            // Deliberately rebuilt now rather than reusing the snapshot taken at
            // submission: a flagged pickup can sit in review for days, and the
            // day that was empty then may be full today.
            //
            // Here the category IS known -- an admin has just approved it -- so
            // the slots are filtered by vehicle properly, unlike the submission
            // path where classification has not happened yet.
            var category = ParseCategory(storedResult);
            var context = await _routingOptions.BuildAsync(
                pickup.ZoneId.Value, category, pickup.PreferredDate);

            if (context.Options.Count == 0)
                return "No collector equipped for this pickup has a free slot in the next two weeks.";

            routing = await _agents.RouteApprovedPickupAsync(new RouteApprovedPickupRequestDto
            {
                PickupRequest = new Dictionary<string, object>
                {
                    ["resident_zone_id"] = pickup.ZoneId.Value.ToString(),
                    ["description"] = pickup.Description ?? string.Empty
                },
                PipelineResult = storedResult.RootElement.Clone(),
                RoutingContext = context
            });
        }
        catch (Exception ex)
        {
            // The client throws when the agent answers but refuses -- most often
            // its own guard saying this pickup was never flagged or is already
            // routed. That is worth showing the admin verbatim-ish, not hiding.
            _logger.LogError(ex, "Routing failed for approved pickup {PickupId}.", pickup.Id);
            return "The agent service rejected the routing request. The approval was saved; " +
                   "retry scheduling or assign a collector manually.";
        }
        finally
        {
            storedResult.Dispose();
        }

        if (routing is null)
        {
            _logger.LogWarning(
                "Agent service unavailable while routing approved pickup {PickupId}.", pickup.Id);
            return "The agent service is unavailable. The approval was saved, but no collector " +
                   "has been assigned yet -- retry in a moment.";
        }

        if (!AgentRoutingMapper.TryBuild(
                pickup.Id, pickup.ZoneId.Value, routing, out var assignment, out var error))
        {
            _logger.LogError(
                "Agent returned an unusable routing decision for pickup {PickupId}: {Error}",
                pickup.Id, error);
            return error + " The approval was saved; assign a collector manually.";
        }

        _db.RouteAssignments.Add(assignment!);
        pickup.Status = PickupStatus.Scheduled;
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Approved pickup {PickupId} scheduled with collector {CollectorId}.",
            pickup.Id, assignment!.CollectorId);
        return null;
    }

    /// <summary>
    /// Current pending load per collector, in the shape the routing agent expects.
    /// </summary>
    private async Task<Dictionary<string, int>> GetCollectorLoadsAsync()
    {
        var report = await _routes.GetLoadReportAsync();
        return report.ToDictionary(c => c.CollectorId.ToString(), c => c.PendingAssignments);
    }

    /// <summary>
    /// The collector loads the routing agent is allowed to choose from, narrowed
    /// to the zone's own collector when it has one.
    /// </summary>
    /// <remarks>
    /// Same reason as the submission path: the agent only ever picks the lowest
    /// load and is never told which collector serves which zone, so an
    /// unfiltered list routes work across zone boundaries. Falls back to every
    /// collector when the zone has nobody assigned.
    /// </remarks>
    /// <summary>
    /// The category the pipeline settled on, read back from the stored result.
    /// </summary>
    /// <remarks>
    /// Falls back to General when the stored JSON predates the field or cannot
    /// be read: that only widens the slots offered, and the vehicle rules are
    /// enforced again when the assignment is built.
    /// </remarks>
    private static WasteCategory ParseCategory(JsonDocument storedResult)
    {
        try
        {
            if (storedResult.RootElement.TryGetProperty("classification", out var classification)
                && classification.TryGetProperty("category", out var category)
                && Enum.TryParse<WasteCategory>(category.GetString(), ignoreCase: true, out var parsed))
            {
                return parsed;
            }
        }
        catch (InvalidOperationException)
        {
            // Stored JSON of an unexpected shape; the fallback is safe.
        }

        return WasteCategory.General;
    }

    /// <summary>
    /// Whether this pickup is bulky -- either the resident said so, or the
    /// classifier decided it was.
    /// </summary>
    /// <summary>
    /// Stores the resident-facing wording of an admin's decision.
    /// </summary>
    /// <remarks>
    /// On approve, reuses the Notifier draft from the pipeline when present;
    /// otherwise asks the agent service to phrase the decision. Rejections copy
    /// the admin's rejection reason straight onto the pickup for the resident.
    ///
    /// Best-effort: the decision itself is already saved, and losing the
    /// friendly wording must not lose the decision.
    /// </remarks>
    private async Task WriteDecisionMessageAsync(
        ApprovalRequest entity,
        bool approved,
        string? reason)
    {
        if (!approved) return;

        var pickup = entity.PickupRequest;
        if (pickup is null) return;

        try
        {
            string? message = ReadStoredResidentNotification(entity.PipelineResultJson);

            if (string.IsNullOrWhiteSpace(message) && !string.IsNullOrWhiteSpace(reason))
            {
                var written = await _agents.ExplainDecisionAsync(new DTOs.ExplainDecisionRequestDto
                {
                    Approved = true,
                    Reason = reason,
                    Description = pickup.Description ?? string.Empty
                });
                message = written?.ResidentMessage;
            }

            if (string.IsNullOrWhiteSpace(message)) return;

            pickup.ResidentMessage = message.Length > 1000 ? message[..1000] : message;
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Could not write the resident message for approval {ApprovalId}; the decision " +
                "itself still stands.", entity.Id);
        }
    }

    /// <summary>The resident message the Notifier wrote when the pickup was flagged.</summary>
    private static string? ReadStoredResidentNotification(string? pipelineResultJson)
    {
        if (string.IsNullOrWhiteSpace(pipelineResultJson)) return null;

        try
        {
            using var document = JsonDocument.Parse(pipelineResultJson);
            if (document.RootElement.TryGetProperty("approval", out var approval)
                && approval.ValueKind == JsonValueKind.Object
                && approval.TryGetProperty("resident_notification", out var note))
            {
                return note.GetString();
            }
        }
        catch (JsonException)
        {
            // Unreadable stored JSON is not worth failing a decision over.
        }

        return null;
    }

    private async Task<bool> IsBulkAsync(Guid pickupRequestId)
    {
        var declared = await _db.PickupRequests
            .AsNoTracking()
            .Where(p => p.Id == pickupRequestId)
            .Select(p => p.IsBulkRequest)
            .FirstOrDefaultAsync();

        if (declared) return true;

        return await _db.WasteClassifications
            .AsNoTracking()
            .Where(w => w.PickupRequestId == pickupRequestId)
            .OrderByDescending(w => w.CreatedAt)
            .Select(w => w.Category)
            .FirstOrDefaultAsync() == WasteCategory.Bulk;
    }

    private async Task<Dictionary<string, int>> ZoneAwareLoadsAsync(
        Guid zoneId,
        Dictionary<string, int> allLoads)
    {
        var zoneCollectorId = await _db.Zones
            .Where(z => z.Id == zoneId)
            .Select(z => z.AssignedCollectorId)
            .FirstOrDefaultAsync();

        if (zoneCollectorId is null) return allLoads;

        var key = zoneCollectorId.Value.ToString();
        return allLoads.TryGetValue(key, out var load)
            ? new Dictionary<string, int> { [key] = load }
            : allLoads;
    }

    public async Task<ApprovalResponseDto?> RejectAsync(Guid id, Guid adminId, RejectApprovalDto dto)
    {
        var entity = await _db.ApprovalRequests
            .Include(a => a.PickupRequest)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (entity is null) return null;
        if (entity.Status != ApprovalStatus.Pending)
            throw new InvalidOperationException("Only pending approval requests can be rejected.");

        entity.Status = ApprovalStatus.Rejected;
        entity.ReviewedByAdminId = adminId;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewNotes = dto.Reason.Trim();

        // The pickup itself was left as Classified before this: not scheduled,
        // not refused, invisible to everyone including the resident who asked.
        if (entity.PickupRequest is not null)
        {
            entity.PickupRequest.Status = PickupStatus.Rejected;
            var residentText = dto.Reason.Trim();
            entity.PickupRequest.ResidentMessage = residentText.Length > ApprovalMessageLimits.ResidentMessageMax
                ? residentText[..ApprovalMessageLimits.ResidentMessageMax]
                : residentText;
        }

        await _db.SaveChangesAsync();

        return ToDto(entity);
    }

    public async Task<ApprovalResponseDto?> RequestRevisionAsync(
        Guid id, Guid adminId, RequestRevisionDto dto)
    {
        var entity = await _db.ApprovalRequests
            .Include(a => a.PickupRequest)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (entity is null) return null;
        if (entity.Status != ApprovalStatus.Pending)
            throw new InvalidOperationException("Only pending approval requests can ask for a revision.");

        entity.Status = ApprovalStatus.RevisionRequested;
        entity.ReviewedByAdminId = adminId;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewNotes = dto.Message.Trim();

        if (entity.PickupRequest is not null
            && entity.PickupRequest.Status is PickupStatus.Classified or PickupStatus.Approved)
        {
            entity.PickupRequest.Status = PickupStatus.Pending;
        }

        await _db.SaveChangesAsync();
        return ToDto(entity);
    }

    private static ApprovalResponseDto ToDto(ApprovalRequest a) => new()
    {
        Id = a.Id,
        PickupRequestId = a.PickupRequestId,
        FlagReason = a.FlagReason,
        Status = a.Status.ToString(),
        ReviewedByAdminId = a.ReviewedByAdminId,
        ReviewNotes = a.ReviewNotes,
        ReviewedAt = a.ReviewedAt,
        CreatedAt = a.CreatedAt
    };
}
