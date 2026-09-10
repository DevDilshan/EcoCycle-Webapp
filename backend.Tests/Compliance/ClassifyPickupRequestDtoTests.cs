using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using backend.DTOs;
using backend.Models;

namespace backend.Tests.Compliance;

public class ClassifyPickupRequestDtoTests
{
    // Same options ASP.NET Core uses for request bodies.
    private static readonly JsonSerializerOptions WebJson = new(JsonSerializerDefaults.Web);

    [Fact]
    public void Category_can_be_sent_by_name()
    {
        var dto = JsonSerializer.Deserialize<ClassifyPickupRequestDto>(
            """{ "category": "Hazardous", "confidence": 0.45, "reasoning": "Batteries" }""", WebJson);

        Assert.Equal(WasteCategory.Hazardous, dto!.Category);
    }

    [Fact]
    public void Category_can_still_be_sent_as_a_number()
    {
        var dto = JsonSerializer.Deserialize<ClassifyPickupRequestDto>(
            """{ "category": 2, "confidence": 0.45, "reasoning": "Batteries" }""", WebJson);

        Assert.Equal(WasteCategory.Hazardous, dto!.Category);
    }

    [Fact]
    public void Missing_category_and_confidence_fail_validation()
    {
        var dto = JsonSerializer.Deserialize<ClassifyPickupRequestDto>(
            """{ "reasoning": "Bottles" }""", WebJson)!;

        var errors = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(dto, new ValidationContext(dto), errors, validateAllProperties: true);

        Assert.False(isValid);
        var invalidMembers = errors.SelectMany(e => e.MemberNames).ToList();
        Assert.Contains(nameof(ClassifyPickupRequestDto.Category), invalidMembers);
        Assert.Contains(nameof(ClassifyPickupRequestDto.Confidence), invalidMembers);
    }
}
