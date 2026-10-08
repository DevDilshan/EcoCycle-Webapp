using System.ComponentModel.DataAnnotations;
using backend.DTOs;

namespace backend.Tests.Validation;

public class RejectApprovalDtoValidationTests
{
    [Fact]
    public void Empty_reason_fails_validation()
    {
        var dto = new RejectApprovalDto { Reason = "   " };
        var results = Validate(dto);
        Assert.NotEmpty(results);
    }

    [Fact]
    public void Short_reason_fails_validation()
    {
        var dto = new RejectApprovalDto { Reason = "Too short" };
        var results = Validate(dto);
        Assert.Contains(results, r => r.MemberNames.Contains(nameof(RejectApprovalDto.Reason)));
    }

    [Fact]
    public void Valid_reason_passes()
    {
        var dto = new RejectApprovalDto
        {
            Reason = "This item cannot be collected as submitted. Please contact support for options.",
        };
        Assert.Empty(Validate(dto));
    }

    private static IList<ValidationResult> Validate(RejectApprovalDto dto)
    {
        var context = new ValidationContext(dto);
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(dto, context, results, validateAllProperties: true);
        return results;
    }
}
