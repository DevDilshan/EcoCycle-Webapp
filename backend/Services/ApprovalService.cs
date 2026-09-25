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
    private readonly ILogger<ApprovalService> _logger;

    public ApprovalService(
        ApplicationDbContext db,
        IAgentPipelineClient agents,
        RouteAssignmentService routes,
        ILogger<ApprovalService> logger)
    {
        _db = db;
        _agents = agents;
        _routes = routes;
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
            entity.PickupRequest.Status = PickupStatus.Approved;

        // The approval is committed before routing is attempted. An admin's
        // decision must not be lost because the agent service is having a bad
        // day -- a pickup left Approved but unassigned is recoverable, an
        // approval that silently failed to save is not.
        await _db.SaveChangesAsync();

        var routingWarning = await TryRouteApprovedPickupAsync(entity);

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
            // Deliberately re-read the loads now rather than reusing the snapshot
            // taken at submission: a flagged pickup can sit in review for days,
            // and the collector who was quietest then may be the busiest today.
            var loads = await GetCollectorLoadsAsync();
            if (loads.Count == 0)
                return "No collectors are available to take this pickup.";

            routing = await _agents.RouteApprovedPickupAsync(new RouteApprovedPickupRequestDto
            {
                PickupRequest = new Dictionary<string, object>
                {
                    ["resident_zone_id"] = pickup.ZoneId.Value.ToString(),
                    ["description"] = pickup.Description ?? string.Empty
                },
                PipelineResult = storedResult.RootElement.Clone(),
                CollectorLoads = loads
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
