using System.ComponentModel.DataAnnotations;

namespace backend.Validation;

public static class PickupLocationValidation
{
    public static IEnumerable<ValidationResult> Validate(double? latitude, double? longitude)
    {
        if (latitude.HasValue != longitude.HasValue)
            yield return new ValidationResult("Choose both latitude and longitude for the pickup pin.",
                new[] { "Latitude", "Longitude" });
        if (latitude is double lat && (!double.IsFinite(lat) || lat < -90 || lat > 90))
            yield return new ValidationResult("Latitude must be between -90 and 90.", new[] { "Latitude" });
        if (longitude is double lng && (!double.IsFinite(lng) || lng < -180 || lng > 180))
            yield return new ValidationResult("Longitude must be between -180 and 180.", new[] { "Longitude" });
    }
}
