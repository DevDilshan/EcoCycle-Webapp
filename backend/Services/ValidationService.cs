using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services.Rules;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class ValidationService : IValidationService
{
    private readonly ApplicationDbContext _db;

    public ValidationService(ApplicationDbContext db) => _db = db;

    public async Task<ValidationResultDto?> ValidateAsync(Guid pickupRequestId)
    {
        var pickup = await _db.PickupRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == pickupRequestId);

        if (pickup is null) return null;

        // A pickup can be classified more than once - the newest classification wins.
        var classification = await _db.WasteClassifications
            .AsNoTracking()
            .Where(w => w.PickupRequestId == pickupRequestId)
            .OrderByDescending(w => w.CreatedAt)
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Pickup request has not been classified yet.");

        var result = RewardRules.Evaluate(new ValidationInput
        {
            Category = classification.Category,
            BulkPickupsThisMonth = await CountBulkPickupsThisMonthAsync(pickup, classification.Category)
        });

        result.PickupRequestId = pickup.Id;
        return result;
    }

    // Distinct bulk pickups by the same resident this UTC month, counting the current one.
    private async Task<int> CountBulkPickupsThisMonthAsync(PickupRequest pickup, WasteCategory currentCategory)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);

        var otherBulkPickups = await _db.WasteClassifications
            .AsNoTracking()
            .Where(w => w.Category == RewardRules.BulkCategory
                        && w.PickupRequestId != pickup.Id
                        && w.PickupRequest!.ResidentId == pickup.ResidentId
                        && w.PickupRequest.CreatedAt >= monthStart
                        && w.PickupRequest.CreatedAt < monthEnd)
            .Select(w => w.PickupRequestId)
            .Distinct()
            .CountAsync();

        return otherBulkPickups + (currentCategory == RewardRules.BulkCategory ? 1 : 0);
    }
}
