using System.ComponentModel.DataAnnotations;
using backend.DTOs;

namespace backend.Tests.Validation;

public class RewardDtoValidationTests
{
    private static List<ValidationResult> Validate(AwardRewardPointsDto dto)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(dto, new ValidationContext(dto), results, validateAllProperties: true);
        return results;
    }

    [Fact]
    public void Valid_award_passes()
    {
        var dto = new AwardRewardPointsDto
        {
            ResidentId = Guid.NewGuid(),
            PickupRequestId = Guid.NewGuid(),
            PointsEarned = 10,
            Reason = "Manual correction after review",
        };
        Assert.Empty(Validate(dto));
    }

    [Fact]
    public void Zero_points_is_refused()
    {
        var dto = new AwardRewardPointsDto
        {
            ResidentId = Guid.NewGuid(),
            PickupRequestId = Guid.NewGuid(),
            PointsEarned = 0,
            Reason = "Should not allow zero",
        };
        Assert.Contains(Validate(dto), r => r.MemberNames.Contains("PointsEarned"));
    }

    [Fact]
    public void Missing_reason_is_refused()
    {
        var dto = new AwardRewardPointsDto
        {
            ResidentId = Guid.NewGuid(),
            PickupRequestId = Guid.NewGuid(),
            PointsEarned = 5,
            Reason = "",
        };
        Assert.Contains(Validate(dto), r => r.MemberNames.Contains("Reason"));
    }
}
