using System.ComponentModel.DataAnnotations;
using backend.DTOs;

namespace backend.Tests.Validation;

public class RouteAssignmentDtoValidationTests
{
    private static List<ValidationResult> Validate(CreateRouteAssignmentDto dto)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(dto, new ValidationContext(dto), results, validateAllProperties: true);
        if (results.Count == 0)
            results.AddRange(dto.Validate(new ValidationContext(dto)));
        return results;
    }

    [Fact]
    public void Valid_assignment_passes()
    {
        var dto = new CreateRouteAssignmentDto
        {
            PickupRequestId = Guid.NewGuid(),
            CollectorId = Guid.NewGuid(),
            ZoneId = Guid.NewGuid(),
            ScheduledDate = DateTime.UtcNow.Date,
        };
        Assert.Empty(Validate(dto));
    }

    [Fact]
    public void Empty_guids_are_refused()
    {
        var dto = new CreateRouteAssignmentDto { ScheduledDate = DateTime.UtcNow.Date };
        var results = Validate(dto);
        Assert.Contains(results, r => r.MemberNames.Contains("pickupRequestId"));
        Assert.Contains(results, r => r.MemberNames.Contains("collectorId"));
        Assert.Contains(results, r => r.MemberNames.Contains("zoneId"));
    }

    [Fact]
    public void Past_scheduled_date_is_refused()
    {
        var dto = new CreateRouteAssignmentDto
        {
            PickupRequestId = Guid.NewGuid(),
            CollectorId = Guid.NewGuid(),
            ZoneId = Guid.NewGuid(),
            ScheduledDate = DateTime.UtcNow.Date.AddDays(-1),
        };
        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("past"));
    }
}
