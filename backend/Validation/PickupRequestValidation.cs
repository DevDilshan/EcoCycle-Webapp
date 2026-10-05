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
    /// Whether a contact number could be dialled.
    /// </summary>
    /// <remarks>
    /// The separators are stripped before the digits are counted, so a resident
    /// is not refused over a space or a dash they cannot see. 9 to 15 digits is
    /// the E.164 range, which accepts a local 0771234567 and an international
    /// +94771234567 without pinning the form to one country's format.
    ///
    /// Deliberately not an exact length. A fixed ten digits reads as correct for
    /// Sri Lankan mobiles and then refuses the international form of the very
    /// same number.
    /// </remarks>
    public static bool IsDialable(string? phone)
    {
        var trimmed = phone?.Trim() ?? "";
        if (trimmed.Length == 0) return false;
        // A plus is allowed only as the first character; anywhere else it is not
        // a separator but a sign the number is malformed.
        var body = trimmed.StartsWith('+') ? trimmed[1..] : trimmed;
        if (body.Any(c => !char.IsDigit(c) && c is not (' ' or '-' or '(' or ')'))) return false;
        var digits = body.Count(char.IsDigit);
        return digits >= 9 && digits <= 15;
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