using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Compliance;

public class ComplianceServiceTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private PickupRequest AddPendingPickup()
    {
        var pickup = new PickupRequest
        {
            ResidentId = Guid.NewGuid(),
            PreferredDate = DateTime.UtcNow.AddDays(1),
            Status = PickupStatus.Pending
        };
        _db.PickupRequests.Add(pickup);
        _db.SaveChanges();
        return pickup;
    }

    [Fact]
    public async Task Low_confidence_is_flagged_but_not_charged_to_the_resident()
    {
        var pickup = AddPendingPickup();

        var result = await new ComplianceService(_db).ClassifyAndEvaluateAsync(pickup.Id, new ClassifyPickupRequestDto
        {
            Category = WasteCategory.Recyclable,
            Confidence = 0.45,
            Reasoning = "Clear plastic bottles"
        });

        Assert.True(result.Flagged);
        Assert.NotNull(result.ApprovalRequest);
        Assert.Equal(0, await _db.ComplianceViolations.CountAsync());
    }

    [Fact]
    public async Task Mixed_waste_is_still_charged_to_the_resident()
    {
        var pickup = AddPendingPickup();

        await new ComplianceService(_db).ClassifyAndEvaluateAsync(pickup.Id, new ClassifyPickupRequestDto
        {
            Category = WasteCategory.Recyclable,
            Confidence = 0.95,
            Reasoning = "Bottles mixed with food waste"
        });

        var violation = Assert.Single(await _db.ComplianceViolations.ToListAsync());
        Assert.Equal(pickup.ResidentId, violation.ResidentId);
    }
}
