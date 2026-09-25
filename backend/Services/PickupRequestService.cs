using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class PickupRequestService : IPickupRequestService
{
    private readonly ApplicationDbContext _db;
    private readonly IAgentPipelineClient _agents;
    private readonly RouteAssignmentService _routes;
    private readonly ILogger<PickupRequestService> _logger;

    public PickupRequestService(
        ApplicationDbContext db,
        IAgentPipelineClient agents,
        RouteAssignmentService routes,
        ILogger<PickupRequestService> logger)
    {
        _db = db;
        _agents = agents;
        _routes = routes;
        _logger = logger;
    }

    /// <summary>
    /// Creates a pickup request and runs it through the Python agent pipeline.
    /// </summary>
    /// <remarks>
    /// The pickup is always saved first, and every later step is best-effort: if
    /// the agent service is slow, down, or misconfigured, the resident's request
    /// still lands as Pending and an admin can classify it by hand. Nothing here
    /// may fail the resident's submission because of an AI outage.
    /// </remarks>
    public async Task<PickupRequestResponseDto> CreateAsync(Guid residentId, CreatePickupRequestDto dto)
    {
        var entity = new PickupRequest
        {
            ResidentId = residentId,
            PhotoUrl = dto.PhotoUrl,
            Description = dto.Description,
            PreferredDate = NormalizeToUtc(dto.PreferredDate),
            IsRecurring = dto.IsRecurring,
            RecurrenceInterval = dto.RecurrenceInterval,
            Status = PickupStatus.Pending
        };

        // TODO: residents cannot choose a zone yet, so every pickup lands in the
        // first active zone. Replace with a resident-selected or address-derived
        // zone -- see PickupRequest.ZoneId.
        entity.ZoneId = await _db.Zones
            .Where(z => z.IsActive)
            .OrderBy(z => z.CreatedAt).ThenBy(z => z.Id)
            .Select(z => (Guid?)z.Id)
            .FirstOrDefaultAsync();

        _db.PickupRequests.Add(entity);
        await _db.SaveChangesAsync();

        await TryRunAgentPipelineAsync(entity);

        return ToDto(entity);
    }

    /// <summary>
    /// Best-effort pass through the agent pipeline. Logs and swallows every
    /// failure: the pickup already exists, and Pending is a valid state an admin
    /// can resolve by hand.
    /// </summary>
    private async Task TryRunAgentPipelineAsync(PickupRequest entity)
    {
        if (entity.ZoneId is null)
        {
            _logger.LogWarning(
                "Pickup {PickupId} has no zone (no active zones exist); skipping the agent " +
                "pipeline and leaving it Pending for manual handling.", entity.Id);
            return;
        }

        if (string.IsNullOrWhiteSpace(entity.Description))
        {
            // The classifier rejects an empty description outright, so there is
            // nothing to send and no point paying for the call.
            _logger.LogInformation(
                "Pickup {PickupId} has no description; skipping the agent pipeline.", entity.Id);
            return;
        }

        PipelineResultDto? result;
        try
        {
            var loads = await GetCollectorLoadsAsync();
            if (loads.Count == 0)
            {
                _logger.LogWarning(
                    "No collector has any route assignments, so the routing agent would have " +
                    "nothing to choose from; leaving pickup {PickupId} Pending.", entity.Id);
                return;
            }

            result = await _agents.RunPipelineAsync(new RunPipelineRequestDto
            {
                Description = entity.Description,
                ResidentZoneId = entity.ZoneId.Value.ToString(),
                CollectorLoads = loads,
                PhotoUrl = entity.PhotoUrl
            });
        }
        catch (Exception ex)
        {
            // The client throws when the service answers but rejects us -- a bad
            // internal key, a contract mismatch. That is our bug, not the
            // resident's problem, so it is logged loudly and swallowed here.
            _logger.LogError(ex, "Agent pipeline call failed for pickup {PickupId}.", entity.Id);
            return;
        }

        if (result is null)
        {
            _logger.LogWarning(
                "Agent service unavailable; pickup {PickupId} stays Pending for manual classification.",
                entity.Id);
            return;
        }

        try
        {
            await ApplyPipelineResultAsync(entity, result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not apply the pipeline result to pickup {PickupId}.", entity.Id);
        }
    }

    /// <summary>
    /// Records the classification, runs the C#-only compliance rules as a second
    /// pass, then either raises an approval task or schedules the pickup.
    /// </summary>
    private async Task ApplyPipelineResultAsync(PickupRequest entity, PipelineResultDto result)
    {
        if (!Enum.TryParse<WasteCategory>(result.Classification.Category, ignoreCase: true, out var category))
        {
            _logger.LogError(
                "Agent returned category {Category} for pickup {PickupId}, which is not a WasteCategory; " +
                "leaving it Pending.", result.Classification.Category, entity.Id);
            return;
        }

        var reasoning = Truncate(result.Classification.Reasoning, 2000);

        _db.WasteClassifications.Add(new WasteClassification
        {
            PickupRequestId = entity.Id,
            Category = category,
            Confidence = Math.Clamp(result.Classification.Confidence, 0, 1),
            Reasoning = reasoning
        });

        entity.Status = PickupStatus.Classified;

        // Second pass. These checks are deliberately NOT in Python: EWaste is a
        // category the agents never flag, the contamination check reads the
        // classifier's own wording, and only this side knows which findings are
        // charged to the resident.
        var findings = ComplianceRules.Evaluate(category, result.Classification.Confidence, reasoning);

        foreach (var finding in findings.Where(f => f.ChargedToResident))
        {
            _db.ComplianceViolations.Add(new ComplianceViolation
            {
                ResidentId = entity.ResidentId,
                PickupRequestId = entity.Id,
                RuleViolated = finding.Message
            });
        }

        var flagReasons = new List<string>();
        if (!string.IsNullOrWhiteSpace(result.FlagReason))
            flagReasons.Add(result.FlagReason!);
        flagReasons.AddRange(findings.Select(f => f.Message));

        if (flagReasons.Count > 0)
        {
            _db.ApprovalRequests.Add(new ApprovalRequest
            {
                PickupRequestId = entity.Id,
                FlagReason = Truncate(string.Join("; ", flagReasons), 2000),
                Status = ApprovalStatus.Pending,
                PipelineResultJson = result.RawJson
            });

            _logger.LogInformation(
                "Pickup {PickupId} flagged for admin review: {FlagReason}",
                entity.Id, string.Join("; ", flagReasons));
        }
        else if (AgentRoutingMapper.TryBuild(
                     entity.Id, entity.ZoneId!.Value, result.Routing, out var assignment, out var routingError))
        {
            _db.RouteAssignments.Add(assignment!);
            entity.Status = PickupStatus.Scheduled;
        }
        else
        {
            _logger.LogWarning(
                "Pickup {PickupId} passed validation but could not be routed: {Error}",
                entity.Id, routingError);
        }

        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Current load per collector, in the shape the routing agent expects:
    /// collector id to the number of pickups still outstanding.
    /// </summary>
    private async Task<Dictionary<string, int>> GetCollectorLoadsAsync()
    {
        var report = await _routes.GetLoadReportAsync();

        // PendingAssignments, not TotalAssignments: balancing on lifetime totals
        // would permanently penalise the collectors who finish the most work.
        return report.ToDictionary(c => c.CollectorId.ToString(), c => c.PendingAssignments);
    }

    private static string Truncate(string? value, int maxLength) =>
        string.IsNullOrEmpty(value) ? string.Empty
        : value.Length <= maxLength ? value
        : value[..maxLength];

    public async Task<PagedResult<PickupRequestResponseDto>> GetListAsync(
        Guid residentId, bool isAdmin, bool isCollector, PickupRequestQueryParams query)
    {
        var q = _db.PickupRequests.AsNoTracking().AsQueryable();

        // Visibility: residents only see their own; admin/collector see all
        if (!isAdmin && !isCollector)
            q = q.Where(p => p.ResidentId == residentId);

        // Filtering
        if (query.Status.HasValue)
        {
            q = q.Where(p => p.Status == query.Status.Value);
        }

        if (query.FromDate.HasValue) {
        
            var from = NormalizeToUtc(query.FromDate.Value);
            q = q.Where(p => p.PreferredDate >= from);
        }
        if (query.ToDate.HasValue){
        
            var to = NormalizeToUtc(query.ToDate.Value);
            q = q.Where(p => p.PreferredDate <= to);
        }


        // Sorting
        bool desc = string.Equals(query.SortDir, "desc", StringComparison.OrdinalIgnoreCase);
        q = query.SortBy?.ToLowerInvariant() switch
        {
            "preferreddate" => desc ? q.OrderByDescending(p => p.PreferredDate) : q.OrderBy(p => p.PreferredDate),
            "status"        => desc ? q.OrderByDescending(p => p.Status)        : q.OrderBy(p => p.Status),
            _               => desc ? q.OrderByDescending(p => p.CreatedAt)     : q.OrderBy(p => p.CreatedAt),
        };

        var total = await q.CountAsync();

        var items = await ProjectToDto(
                q.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize))
            .ToListAsync();

        return new PagedResult<PickupRequestResponseDto>
        {
            Items = items,
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = total
        };
    }

    public async Task<PickupRequestResponseDto?> GetByIdAsync(Guid id, Guid residentId, bool isAdmin)
    {
        var dto = await ProjectToDto(
                _db.PickupRequests.AsNoTracking().Where(p => p.Id == id))
            .FirstOrDefaultAsync();

        if (dto is null) return null;
        if (!isAdmin && dto.ResidentId != residentId) return null; // hide existence from other residents
        return dto;
    }

    public async Task<PickupStatusDto?> GetStatusAsync(Guid id, Guid residentId, bool isAdmin)
    {
        var entity = await _db.PickupRequests.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return null;
        if (!isAdmin && entity.ResidentId != residentId) return null;
        return new PickupStatusDto { Id = entity.Id, Status = entity.Status.ToString() };
    }

    public async Task<PickupRequestResponseDto?> UpdateAsync(
        Guid id, Guid residentId, bool isAdmin, UpdatePickupRequestDto dto)
    {
        var entity = await _db.PickupRequests.FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return null;
        if (!isAdmin && entity.ResidentId != residentId)
            throw new UnauthorizedAccessException();
        if (entity.Status != PickupStatus.Pending)
            throw new InvalidOperationException("Only pending requests can be edited.");

        entity.PhotoUrl = dto.PhotoUrl;
        entity.Description = dto.Description;
        entity.PreferredDate = NormalizeToUtc(dto.PreferredDate);
        entity.IsRecurring = dto.IsRecurring;
        entity.RecurrenceInterval = dto.RecurrenceInterval;

        await _db.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<PickupOperationResult> DeleteAsync(Guid id, Guid residentId, bool isAdmin)
    {
        var entity = await _db.PickupRequests.FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return PickupOperationResult.NotFound;
        if (!isAdmin && entity.ResidentId != residentId) return PickupOperationResult.Forbidden;
        if (entity.Status != PickupStatus.Pending) return PickupOperationResult.NotEditable;

        _db.PickupRequests.Remove(entity);
        await _db.SaveChangesAsync();
        return PickupOperationResult.Success;
    }

    public async Task<ClassifyResponseDto?> ClassifyAsync(Guid id) {

        var entity = await _db.PickupRequests.FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return null;

        // Status-flow guard: only a Pending request can be classified
        if (entity.Status != PickupStatus.Pending)
            throw new InvalidOperationException("Only pending requests can be classified.");

        // --- STUB: always Recyclable. Swap for a real classifier later. ---
        var category = WasteCategory.Recyclable;

        _db.WasteClassifications.Add(new WasteClassification
        {
            PickupRequestId = entity.Id,
            Category = category,
            Confidence = 1.0,                                   // stub confidence
            Reasoning = "Stub classification — manually set to Recyclable."
        });

        entity.Status = PickupStatus.Classified;               // Pending -> Classified

        await _db.SaveChangesAsync();

        return new ClassifyResponseDto
        {
            PickupRequestId = entity.Id,
            Category = category.ToString(),
            Confidence = 1.0,
            Status = entity.Status.ToString()
        };
    }

    // Npgsql 8 requires Kind=Utc for timestamptz; treat offset-less input as UTC, convert the rest
    private static DateTime NormalizeToUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();
    /// <summary>
    /// Projects pickups together with their classification and approval state.
    /// </summary>
    /// <remarks>
    /// Written as sub-queries rather than Includes so it stays a single SQL
    /// round trip and returns only the handful of columns the UI needs, rather
    /// than whole WasteClassification and ApprovalRequest rows.
    ///
    /// Both sub-queries take the newest row: a pickup can be reclassified (the
    /// agent pipeline on submission, then an admin correcting it by hand), and
    /// the latest verdict is the one that counts.
    /// </remarks>
    private IQueryable<PickupRequestResponseDto> ProjectToDto(IQueryable<PickupRequest> source) =>
        source.Select(p => new PickupRequestResponseDto
        {
            Id = p.Id,
            ResidentId = p.ResidentId,
            PhotoUrl = p.PhotoUrl,
            Description = p.Description,
            PreferredDate = p.PreferredDate,
            Status = p.Status.ToString(),
            IsRecurring = p.IsRecurring,
            RecurrenceInterval = p.RecurrenceInterval,
            CreatedAt = p.CreatedAt,

            ZoneId = p.ZoneId,
            ZoneName = _db.Zones
                .Where(z => z.Id == p.ZoneId)
                .Select(z => z.Name)
                .FirstOrDefault(),

            Category = _db.WasteClassifications
                .Where(w => w.PickupRequestId == p.Id)
                .OrderByDescending(w => w.CreatedAt)
                .Select(w => w.Category.ToString())
                .FirstOrDefault(),
            Confidence = _db.WasteClassifications
                .Where(w => w.PickupRequestId == p.Id)
                .OrderByDescending(w => w.CreatedAt)
                .Select(w => (double?)w.Confidence)
                .FirstOrDefault(),
            Reasoning = _db.WasteClassifications
                .Where(w => w.PickupRequestId == p.Id)
                .OrderByDescending(w => w.CreatedAt)
                .Select(w => w.Reasoning)
                .FirstOrDefault(),
            ClassifiedAt = _db.WasteClassifications
                .Where(w => w.PickupRequestId == p.Id)
                .OrderByDescending(w => w.CreatedAt)
                .Select(w => (DateTime?)w.CreatedAt)
                .FirstOrDefault(),

            HasApprovalRequest = _db.ApprovalRequests.Any(a => a.PickupRequestId == p.Id),
            ApprovalRequestId = _db.ApprovalRequests
                .Where(a => a.PickupRequestId == p.Id)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => (Guid?)a.Id)
                .FirstOrDefault(),
            ApprovalStatus = _db.ApprovalRequests
                .Where(a => a.PickupRequestId == p.Id)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => a.Status.ToString())
                .FirstOrDefault(),
            FlagReason = _db.ApprovalRequests
                .Where(a => a.PickupRequestId == p.Id)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => a.FlagReason)
                .FirstOrDefault(),
        });

    // Used by Create/Update, which return the row the caller just wrote. The
    // classification and approval fields are left null there on purpose: the
    // caller already knows there is nothing to report yet, and re-querying for
    // it would cost a round trip per write.
    private static PickupRequestResponseDto ToDto(PickupRequest p) => new()
    {
        Id = p.Id,
        ResidentId = p.ResidentId,
        PhotoUrl = p.PhotoUrl,
        Description = p.Description,
        PreferredDate = p.PreferredDate,
        Status = p.Status.ToString(),
        IsRecurring = p.IsRecurring,
        RecurrenceInterval = p.RecurrenceInterval,
        CreatedAt = p.CreatedAt,
        ZoneId = p.ZoneId
    };
}