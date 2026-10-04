using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class PickupRequestService : IPickupRequestService
{
    /// <summary>
    /// Bulky collections a resident may book per calendar month.
    /// </summary>
    /// <remarks>
    /// Must match MAX_BULK_PICKUPS_PER_MONTH in the Validator agent: this side
    /// refuses the booking up front, that side flags any that slip through
    /// undeclared.
    /// </remarks>
    public const int MaxBulkPickupsPerMonth = 2;

    private readonly ApplicationDbContext _db;
    private readonly IAgentPipelineClient _agents;
    private readonly RouteAssignmentService _routes;
    private readonly RoutingOptionBuilder _routingOptions;
    private readonly ILogger<PickupRequestService> _logger;

    public PickupRequestService(
        ApplicationDbContext db,
        IAgentPipelineClient agents,
        RouteAssignmentService routes,
        RoutingOptionBuilder routingOptions,
        ILogger<PickupRequestService> logger)
    {
        _db = db;
        _agents = agents;
        _routes = routes;
        _routingOptions = routingOptions;
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
            PhotoUrl = NormalizePhotoUrl(dto.PhotoUrl),
            Description = dto.Description,
            PreferredDate = NormalizeToUtc(dto.PreferredDate),
            Address = dto.Address?.Trim(),
            IsBulkRequest = dto.IsBulkRequest,
            IsRecurring = dto.IsRecurring,
            RecurrenceInterval = dto.RecurrenceInterval,
            Status = PickupStatus.Pending
        };

        // The resident chooses the zone. It is validated rather than defaulted:
        // silently filing a pickup in the wrong zone sends a collector to the
        // wrong side of the city, which is worse than refusing the submission.
        var zoneIsUsable = await _db.Zones
            .AnyAsync(z => z.Id == dto.ZoneId && z.IsActive);

        if (!zoneIsUsable)
        {
            throw new ArgumentException(
                "That zone does not exist or is no longer active. Pick a zone from the list.");
        }

        entity.ZoneId = dto.ZoneId;

        // A council tells you the allowance is spent when you book, not after.
        // Checked before the pickup is saved so nothing half-exists.
        if (dto.IsBulkRequest)
        {
            var allowance = await GetBulkAllowanceAsync(residentId);
            if (allowance.Remaining <= 0)
            {
                throw new ArgumentException(
                    $"You have used all {allowance.Limit} bulky-waste collections for this month. " +
                    "The allowance resets on the 1st.");
            }
        }

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
            _logger.LogInformation(
                "Running agent pipeline for pickup {PickupId} (photo supplied: {HasPhoto})",
                entity.Id,
                !string.IsNullOrWhiteSpace(entity.PhotoUrl));

            result = await _agents.RunPipelineAsync(new RunPipelineRequestDto
            {
                Description = entity.Description,
                ResidentZoneId = entity.ZoneId.Value.ToString(),
                // Slots have to be built before the pipeline runs, and the
                // category only exists afterwards -- classification and routing
                // are one call. They are therefore built without a vehicle
                // restriction, and the real category is checked against the
                // chosen collector once it is known (see VehicleCanCarry).
                RoutingContext = await _routingOptions.BuildAsync(
                    entity.ZoneId.Value, WasteCategory.General, entity.PreferredDate),
                PhotoUrl = entity.PhotoUrl,
                ResidentHistory = await ResidentHistoryThisMonthAsync(entity.ResidentId, entity.Id)
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

        // A bulky item that was not booked as one. Most of these are honest --
        // people do not know a mattress counts -- so sending every one to an
        // admin would fill the queue with mistakes and drown the signal.
        //
        // If the resident still has allowance left the outcome is identical to
        // having declared it, so the slot is simply consumed and nobody is
        // troubled. Only the case that actually costs the council something --
        // an undeclared bulky item with the month's allowance already spent --
        // is worth a human looking at it.
        if (category == WasteCategory.Bulk && !entity.IsBulkRequest)
        {
            var allowance = await GetBulkAllowanceAsync(entity.ResidentId);
            if (allowance.Remaining > 0)
            {
                entity.IsBulkRequest = true;
                _logger.LogInformation(
                    "Pickup {PickupId} classified Bulk but was not booked as one; consuming a " +
                    "bulky slot ({Remaining} were left).", entity.Id, allowance.Remaining);
            }
            else
            {
                flagReasons.Add(
                    "Bulky item was not booked as a bulky collection, and this month's " +
                    "allowance is already used.");
            }
        }

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
                     entity.Id, entity.ZoneId!.Value, result.Routing, out var assignment, out var routingError)
                 && await VehicleCanCarryAsync(assignment!.CollectorId, category))
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
    /// <summary>
    /// The collector loads the routing agent is allowed to choose from.
    /// </summary>
    /// <remarks>
    /// Narrowed to the zone's own collector when it has one. The agent is only
    /// ever told "pick the lowest load" and is never given a zone-to-collector
    /// map, so handing it every collector made it choose the globally quietest
    /// one -- which is how a pickup in one zone ended up on a collector who
    /// serves another.
    ///
    /// Falls back to every collector when the zone has nobody assigned, so an
    /// unstaffed zone still gets collected rather than silently stalling.
    /// </remarks>
    /// <summary>
    /// The resident's earlier pickups this calendar month, with the category
    /// each was classified as.
    /// </summary>
    /// <remarks>
    /// Without this the Validator always saw an empty history, so
    /// EXCESSIVE_BULK_PICKUPS ("max 2 bulk pickups per resident per month")
    /// could never fire -- the check is `earlier + 1 > 2`, which is never true
    /// at zero. The agent's own tests passed because they call validate_pickup
    /// directly with a history the real pipeline never supplied.
    ///
    /// Scoped to this month because that is the only window the rule looks at;
    /// loading a resident's whole history would grow without bound for nothing.
    /// </remarks>
    /// <summary>
    /// How much of this month's bulky-waste allowance a resident has left.
    /// </summary>
    /// <remarks>
    /// Counted from what residents declared, not from what the classifier
    /// decided: the booking is the thing being rationed. Rejected pickups do not
    /// count -- a refused booking should not cost someone their allowance.
    /// </remarks>
    /// <summary>
    /// Whether a resident may ask for this pickup to be collected again.
    /// </summary>
    /// <remarks>
    /// Guarded on purpose. Without a check this becomes a button that books a
    /// second truck for a pickup that is simply not due yet, so it is allowed
    /// only when the collection genuinely has not happened: the stop was marked
    /// missed, or its day has passed and nobody closed it off.
    /// </remarks>
    public async Task<(bool NotFound, string? Reason)> CanRequestAgainAsync(
        Guid residentId,
        Guid pickupRequestId)
    {
        var pickup = await _db.PickupRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == pickupRequestId && p.ResidentId == residentId);

        if (pickup is null) return (true, null);

        if (pickup.Status == PickupStatus.Completed)
            return (false, "This pickup has already been collected.");

        var stops = await _db.RouteAssignments
            .AsNoTracking()
            .Where(r => r.PickupRequestId == pickupRequestId)
            .OrderByDescending(r => r.ScheduledDate)
            .Select(r => new { r.CompletionStatus, r.ScheduledDate })
            .ToListAsync();

        if (stops.Count == 0)
            return (false, "This pickup has not been scheduled yet, so there is nothing to repeat.");

        var latest = stops[0];

        if (latest.CompletionStatus == RouteCompletionStatus.Missed) return (false, null);

        if (latest.CompletionStatus == RouteCompletionStatus.Pending
            && latest.ScheduledDate.Date < ServiceClock.Today)
        {
            return (false, null);
        }

        return (false, "This pickup is still booked in. You can ask again if the day passes " +
                       "and it has not been collected.");
    }

    public async Task<BulkAllowanceDto> GetBulkAllowanceAsync(Guid residentId)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var used = await _db.PickupRequests
            .CountAsync(p => p.ResidentId == residentId
                && p.IsBulkRequest
                && p.CreatedAt >= monthStart);

        return new BulkAllowanceDto
        {
            Limit = MaxBulkPickupsPerMonth,
            Used = used,
            Remaining = Math.Max(0, MaxBulkPickupsPerMonth - used)
        };
    }

    private async Task<List<ResidentHistoryEntryDto>> ResidentHistoryThisMonthAsync(
        Guid residentId,
        Guid currentPickupId)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        // The category is projected as the enum and converted in memory: calling
        // ToString() on it inside the query does not translate to SQL.
        var rows = await _db.PickupRequests
            .AsNoTracking()
            .Where(p => p.ResidentId == residentId
                && p.Id != currentPickupId
                && p.CreatedAt >= monthStart)
            .Select(p => new
            {
                p.CreatedAt,
                Category = _db.WasteClassifications
                    .Where(w => w.PickupRequestId == p.Id)
                    .OrderByDescending(w => w.CreatedAt)
                    .Select(w => (WasteCategory?)w.Category)
                    .FirstOrDefault()
            })
            .ToListAsync();

        return rows
            .Where(r => r.Category is not null)
            .Select(r => new ResidentHistoryEntryDto
            {
                Category = r.Category!.Value.ToString(),
                CreatedAt = r.CreatedAt
            })
            .ToList();
    }

    /// <summary>
    /// Whether the chosen collector's vehicle may carry this category.
    /// </summary>
    /// <remarks>
    /// The slots offered to the router are built before the pickup is
    /// classified, so they carry no vehicle restriction. This is the check that
    /// closes that gap: a sofa must not be left with a collector who has no
    /// lift, and hazardous waste must not be left with an unlicensed one, no
    /// matter how sensible the agent's choice looked.
    ///
    /// Failing here simply leaves the pickup unrouted for an admin to place,
    /// which is the safe outcome.
    /// </remarks>
    private async Task<bool> VehicleCanCarryAsync(Guid collectorId, WasteCategory category)
    {
        if (category is not (WasteCategory.Bulk or WasteCategory.Hazardous)) return true;

        var setting = await _db.CollectorSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CollectorId == collectorId);

        var handlesBulky = setting?.HandlesBulky ?? CollectorSettingService.DefaultSetting.HandlesBulky;
        var handlesHazardous = setting?.HandlesHazardous ?? CollectorSettingService.DefaultSetting.HandlesHazardous;

        var allowed = category == WasteCategory.Bulk ? handlesBulky : handlesHazardous;
        if (!allowed)
        {
            _logger.LogWarning(
                "Routing agent chose collector {CollectorId} for a {Category} pickup, but their " +
                "vehicle is not equipped for it; leaving it unrouted.", collectorId, category);
        }
        return allowed;
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

        // If the zone's collector is not in the load report at all (profile
        // removed, role changed), fall back rather than send an empty list.
        return allLoads.TryGetValue(key, out var load)
            ? new Dictionary<string, int> { [key] = load }
            : allLoads;
    }

    private async Task<Dictionary<string, int>> GetCollectorLoadsAsync()
    {
        var report = await _routes.GetLoadReportAsync();

        // PendingAssignments, not TotalAssignments: balancing on lifetime totals
        // would permanently penalise the collectors who finish the most work.
        return report.ToDictionary(c => c.CollectorId.ToString(), c => c.PendingAssignments);
    }

    private static string? NormalizePhotoUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        return url.Trim();
    }

    /// <summary>
    /// Drops prior classification/approval rows so a pending pickup can be
    /// re-run through the agent pipeline (e.g. after a Supabase photo URL is added).
    /// </summary>
    private async Task ClearStalePipelineResultsAsync(Guid pickupRequestId)
    {
        var pendingApprovals = await _db.ApprovalRequests
            .Where(a => a.PickupRequestId == pickupRequestId && a.Status == ApprovalStatus.Pending)
            .ToListAsync();
        if (pendingApprovals.Count > 0)
            _db.ApprovalRequests.RemoveRange(pendingApprovals);

        var classifications = await _db.WasteClassifications
            .Where(w => w.PickupRequestId == pickupRequestId)
            .ToListAsync();
        if (classifications.Count > 0)
            _db.WasteClassifications.RemoveRange(classifications);

        if (pendingApprovals.Count > 0 || classifications.Count > 0)
            await _db.SaveChangesAsync();
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

        var previousPhoto = entity.PhotoUrl;
        var previousDescription = entity.Description;

        entity.PhotoUrl = NormalizePhotoUrl(dto.PhotoUrl);
        entity.Description = dto.Description;
        entity.PreferredDate = NormalizeToUtc(dto.PreferredDate);
        entity.IsRecurring = dto.IsRecurring;
        entity.RecurrenceInterval = dto.RecurrenceInterval;

        await _db.SaveChangesAsync();

        var photoChanged = !string.Equals(previousPhoto, entity.PhotoUrl, StringComparison.Ordinal);
        var descriptionChanged = !string.Equals(previousDescription, entity.Description, StringComparison.Ordinal);
        if (photoChanged || descriptionChanged)
        {
            await ClearStalePipelineResultsAsync(entity.Id);
            await TryRunAgentPipelineAsync(entity);
            await _db.Entry(entity).ReloadAsync();
        }

        return ToDto(entity);
    }

    /// <summary>
    /// Cancels a pickup the resident no longer needs.
    /// </summary>
    /// <remarks>
    /// This used to allow cancelling only while the request was Pending, which
    /// in practice meant never: the agent pipeline runs during submission, so a
    /// request is Classified or Scheduled within seconds. By the time anyone
    /// realised the neighbour had taken the sofa, cancelling was refused and the
    /// crew drove out for nothing.
    ///
    /// It is allowed up until the waste has actually been collected. Anything
    /// already booked is released with it, so the slot goes back to the round
    /// instead of being held for a stop nobody will make.
    /// </remarks>
    public async Task<PickupOperationResult> DeleteAsync(Guid id, Guid residentId, bool isAdmin)
    {
        var entity = await _db.PickupRequests.FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return PickupOperationResult.NotFound;
        if (!isAdmin && entity.ResidentId != residentId) return PickupOperationResult.Forbidden;

        // Once it has been collected there is nothing to cancel, and removing it
        // would erase the record of work that was actually done -- including the
        // points the resident was paid for it.
        if (entity.Status == PickupStatus.Completed) return PickupOperationResult.NotEditable;

        // A refused request is finished too. Nothing is booked against it, so
        // there is no trip to call off, and deleting it would take the reason
        // for the refusal with it -- which is the one thing the resident still
        // needs from that row.
        //
        // The approval record is checked as well as the status. Rejecting only
        // began setting PickupRequest.Status recently; before that it set the
        // approval and left the pickup Classified, so the older refusals are
        // invisible to a status check even though the resident is shown "Not
        // approved" for them.
        if (entity.Status == PickupStatus.Rejected) return PickupOperationResult.NotEditable;

        var wasRefused = await _db.ApprovalRequests
            .AnyAsync(a => a.PickupRequestId == id && a.Status == ApprovalStatus.Rejected);
        if (wasRefused) return PickupOperationResult.NotEditable;

        var collected = await _db.RouteAssignments
            .AnyAsync(r => r.PickupRequestId == id
                && r.CompletionStatus == RouteCompletionStatus.Completed);
        if (collected) return PickupOperationResult.NotEditable;

        // Free the booked stop so the day reads honestly: a cancelled pickup
        // must not keep occupying capacity the router counts against.
        var stops = await _db.RouteAssignments
            .Where(r => r.PickupRequestId == id)
            .ToListAsync();
        _db.RouteAssignments.RemoveRange(stops);

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
            Address = p.Address,
            ResidentMessage = p.ResidentMessage,

            // The most recent attempt, so a resident can see what happened
            // without an inbox. Ordered by scheduled date so a stop booked after
            // a miss is the one reported.
            LastAttemptStatus = _db.RouteAssignments
                .Where(r => r.PickupRequestId == p.Id)
                .OrderByDescending(r => r.ScheduledDate)
                .Select(r => r.CompletionStatus.ToString())
                .FirstOrDefault(),
            LastAttemptNote = _db.RouteAssignments
                .Where(r => r.PickupRequestId == p.Id)
                .OrderByDescending(r => r.ScheduledDate)
                .Select(r => r.IssueNotes)
                .FirstOrDefault(),
            LastAttemptDate = _db.RouteAssignments
                .Where(r => r.PickupRequestId == p.Id)
                .OrderByDescending(r => r.ScheduledDate)
                .Select(r => (DateTime?)r.ScheduledDate)
                .FirstOrDefault(),
            NextVisitDate = _db.RouteAssignments
                .Where(r => r.PickupRequestId == p.Id
                    && r.CompletionStatus == RouteCompletionStatus.Pending)
                .OrderBy(r => r.ScheduledDate)
                .Select(r => (DateTime?)r.ScheduledDate)
                .FirstOrDefault(),
        IsBulkRequest = p.IsBulkRequest,
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
            ApprovalReviewNotes = _db.ApprovalRequests
                .Where(a => a.PickupRequestId == p.Id)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => a.ReviewNotes)
                .FirstOrDefault(),
            ApprovalReviewedAt = _db.ApprovalRequests
                .Where(a => a.PickupRequestId == p.Id)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => a.ReviewedAt)
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
        Address = p.Address,
        IsBulkRequest = p.IsBulkRequest,
        IsRecurring = p.IsRecurring,
        RecurrenceInterval = p.RecurrenceInterval,
        CreatedAt = p.CreatedAt,
        ZoneId = p.ZoneId
    };
}