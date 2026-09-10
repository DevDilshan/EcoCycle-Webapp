using backend.DTOs;
using backend.Models;
using backend.Services.Rules;

namespace backend.Tests.Rules;

// Pure rule checks fed with fake data - no database involved.
public class RewardRulesTests
{
    private static ValidationResultDto Evaluate(WasteCategory category, int bulkPickupsThisMonth = 0) =>
        RewardRules.Evaluate(new ValidationInput
        {
            Category = category,
            BulkPickupsThisMonth = bulkPickupsThisMonth
        });

    [Fact]
    public void Recyclable_pickup_with_no_history_is_valid()
    {
        var result = Evaluate(WasteCategory.Recyclable);

        Assert.True(result.IsValid);
        Assert.False(result.RequiresApproval);
        Assert.Empty(result.ViolatedRules);
    }

    [Fact]
    public void Hazardous_pickup_is_flagged()
    {
        var result = Evaluate(WasteCategory.Hazardous);

        Assert.False(result.IsValid);
        Assert.True(result.RequiresApproval);
        Assert.Equal(new[] { RewardRules.HazardousCategory }, result.ViolatedRules);
    }

    [Fact]
    public void First_bulk_pickup_this_month_is_not_flagged()
    {
        var result = Evaluate(RewardRules.BulkCategory, bulkPickupsThisMonth: 1);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Second_bulk_pickup_this_month_is_flagged()
    {
        var result = Evaluate(RewardRules.BulkCategory, bulkPickupsThisMonth: 2);

        Assert.True(result.RequiresApproval);
        Assert.Equal(new[] { RewardRules.ExcessiveBulkPickups }, result.ViolatedRules);
    }

    [Fact]
    public void Non_bulk_pickup_is_not_flagged_for_the_residents_bulk_history()
    {
        var result = Evaluate(WasteCategory.Recyclable, bulkPickupsThisMonth: 2);

        Assert.True(result.IsValid);
    }
}
