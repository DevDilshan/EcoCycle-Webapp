using System.ComponentModel.DataAnnotations;
using backend.DTOs;

namespace backend.Tests.Validation;

public class ComplaintDtoValidationTests
{
    private static List<ValidationResult> Validate(CreateComplaintDto dto)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(dto, new ValidationContext(dto), results, validateAllProperties: true);
        return results;
    }

    [Fact]
    public void Valid_complaint_passes()
    {
        var dto = new CreateComplaintDto
        {
            PickupRequestId = Guid.NewGuid(),
            Description = "The crew missed my bags on the scheduled day.",
        };
        Assert.Empty(Validate(dto));
    }

    [Fact]
    public void Short_description_is_refused()
    {
        var dto = new CreateComplaintDto
        {
            PickupRequestId = Guid.NewGuid(),
            Description = "Too short",
        };
        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("10 characters"));
    }

    [Fact]
    public void Description_over_2000_chars_is_refused()
    {
        var dto = new CreateComplaintDto
        {
            PickupRequestId = Guid.NewGuid(),
            Description = new string('x', 2001),
        };
        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("2000"));
    }
}
