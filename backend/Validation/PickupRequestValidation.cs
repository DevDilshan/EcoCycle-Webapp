using System.ComponentModel.DataAnnotations;

namespace backend.Validation;

// Shared pickup-request rules, used by both Create and Update DTOs so the
// web, mobile and API all enforce exactly the same thing. Member names are
// camelCase to match the JSON the clients send, so 400 errors map 1:1 to fields.
public static class PickupRequestValidation
{
    public static readonly string[] AllowedIntervals = { "Weekly", "Bi-weekly" };
    public const int MaxFutureDays = 365;

    /// <summary>
    /// Whether a contact number is a valid local mobile number: exactly ten
    /// digits starting with 0 (for example 0771234567). No spaces, dashes or
    /// country code are accepted.
    /// </summary>
    public static bool IsDialable(string? phone)
    {
        var trimmed = phone?.Trim() ?? "";
        return trimmed.Length == 10 && trimmed[0] == '0' && trimmed.All(char.IsDigit);
    }

    public static IEnumerable<ValidationResult> Validate(
        string? description, DateTime preferredDate, bool isRecurring, string? recurrenceInterval)
    {
        // Description — required, 5..1000 after trimming
        var desc = description?.Trim() ?? "";
        if (desc.Length == 0)
            yield return new ValidationResult("Please describe the waste to be collected.", new[] { "description" });
        else if (desc.Length < 5)
            yield return new ValidationResult("Description must be at least 5 characters.", new[] { "description" });
        else if (desc.Length > 1000)
            yield return new ValidationResult("Description must be 1000 characters or fewer.", new[] { "description" });

        // Preferred date — required, not past, within a year
        var today = DateTime.UtcNow.Date;
        if (preferredDate == default)
            yield return new ValidationResult("Please choose a preferred date.", new[] { "preferredDate" });
        else if (preferredDate.Date < today)
            yield return new ValidationResult("Preferred date cannot be in the past.", new[] { "preferredDate" });
        else if (preferredDate.Date > today.AddDays(MaxFutureDays))
            yield return new ValidationResult("Preferred date must be within the next 12 months.", new[] { "preferredDate" });

        // Recurrence — interval required + allowed only when recurring
        if (isRecurring)
        {
            var interval = recurrenceInterval?.Trim() ?? "";
            if (interval.Length == 0)
                yield return new ValidationResult("Choose how often the pickup repeats.", new[] { "recurrenceInterval" });
            else if (!AllowedIntervals.Any(a => a.Equals(interval, StringComparison.OrdinalIgnoreCase)))
                yield return new ValidationResult("Recurrence must be Weekly or Bi-weekly.", new[] { "recurrenceInterval" });
        }
    }
}