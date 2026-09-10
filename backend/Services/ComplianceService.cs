using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class ComplianceService : IComplianceService
{
    private readonly ApplicationDbContext _db;

    public ComplianceService(ApplicationDbContext db) => _db = db;

    public async Task<ClassificationResultDto> ClassifyAndEvaluateAsync(
        Guid pickupRequestId, ClassifyPickupRequestDto dto)
    {
        var pickup = await _db.PickupRequests.FirstOrDefaultAsync(p => p.Id == pickupRequestId)
            ?? throw new KeyNotFoundException("Pickup request not found.");

        if (pickup.Status != PickupStatus.Pending)
            throw new InvalidOperationException("Only pending pickup requests can be classified.");

        var classification = new WasteClassification
        {
            PickupRequestId = pickup.Id,
            Category = dto.Category,
            Confidence = dto.Confidence,
            Reasoning = dto.Reasoning.Trim()
        };
        _db.WasteClassifications.Add(classification);

        pickup.Status = PickupStatus.Classified;

        var violations = ComplianceRules.Evaluate(dto.Category, dto.Confidence, dto.Reasoning);
        ApprovalRequest? approval = null;

        foreach (var rule in violations)
        {
            _db.ComplianceViolations.Add(new ComplianceViolation
            {
                ResidentId = pickup.ResidentId,
                PickupRequestId = pickup.Id,
                RuleViolated = rule
            });
        }

        if (violations.Count > 0)
        {
            approval = await _db.ApprovalRequests
                .FirstOrDefaultAsync(a => a.PickupRequestId == pickup.Id);

            if (approval is null)
            {
                approval = new ApprovalRequest
                {
                    PickupRequestId = pickup.Id,
                    FlagReason = string.Join("; ", violations),
                    Status = ApprovalStatus.Pending
                };
                _db.ApprovalRequests.Add(approval);
            }
        }
        else
        {
            pickup.Status = PickupStatus.Approved;
        }

        await _db.SaveChangesAsync();

        return new ClassificationResultDto
        {
            PickupRequestId = pickup.Id,
            PickupStatus = pickup.Status.ToString(),
            ClassificationId = classification.Id,
            Flagged = violations.Count > 0,
            Violations = violations,
            ApprovalRequest = approval is null ? null : ToApprovalDto(approval)
        };
    }

    private static ApprovalResponseDto ToApprovalDto(ApprovalRequest a) => new()
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
