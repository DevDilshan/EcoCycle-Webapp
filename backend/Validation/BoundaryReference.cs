using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using backend.DTOs;

namespace backend.Validation;

public static class BoundaryReference
{
    public static string? Validate(CreateZoneDto dto)
    {
        if (dto.BoundaryReference == null) return null;
        var reference = dto.BoundaryReference;
        var errors = new List<ValidationResult>();
        Validator.TryValidateObject(reference, new ValidationContext(reference), errors, true);
        if (errors.Count > 0) return errors[0].ErrorMessage;
        if (reference.DatasetId != "lka-cod-ab-v03") return "Choose a supported administrative boundary dataset.";
        if ((reference.AdministrativeLevel == 3 ? 6 : 9) != reference.AreaCode.Length)
            return "The area code must match the administrative level.";
        if (string.IsNullOrWhiteSpace(dto.BoundaryGeoJson)) return "An administrative reference needs a boundary outline.";
        if (!dto.ConfirmCollectionCoverage) return "Review the outline against council collection coverage before saving.";
        return null;
    }

    public static string? Serialize(BoundaryReferenceDto? reference) => reference == null ? null : JsonSerializer.Serialize(reference);
    public static BoundaryReferenceDto? Deserialize(string? json) => json == null ? null : JsonSerializer.Deserialize<BoundaryReferenceDto>(json);
}
