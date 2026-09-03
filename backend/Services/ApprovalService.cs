using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class ApprovalService : IApprovalService
{
    private readonly ApplicationDbContext _db;

    public ApprovalService(ApplicationDbContext db) => _db = db;

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

        await _db.SaveChangesAsync();
        return ToDto(entity);
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
