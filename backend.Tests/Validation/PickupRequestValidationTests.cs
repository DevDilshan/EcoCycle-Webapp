using backend.Validation;

namespace backend.Tests.Validation;

// Pure unit tests for the shared pickup-request validation rules. No database,
// no service -- just the rules a resident's input must pass. These back the
// "validation" evidence for the backend testing requirement.
public class PickupRequestValidationTests
{
    // --- IsDialable: a valid local mobile number. ---
    // Exactly ten digits starting with 0 (e.g. 0771234567); nothing else.

    [Theory]
    [InlineData("0771234567")]        // local 10-digit mobile
    [InlineData("0712345678")]        // any 10 digits starting with 0
    [InlineData("0119876543")]        // land line form, still 10 digits from 0
    [InlineData(" 0771234567 ")]      // surrounding whitespace is trimmed
    public void IsDialable_accepts_ten_digits_starting_with_zero(string phone)
        => Assert.True(PickupRequestValidation.IsDialable(phone));

    [Theory]
    [InlineData("")]                   // empty
    [InlineData("   ")]                // whitespace only
    [InlineData("771234567")]          // 9 digits, no leading 0
    [InlineData("077123456")]          // only 9 digits
    [InlineData("07712345678")]        // 11 digits -- too long
    [InlineData("1771234567")]         // 10 digits but does not start with 0
    [InlineData("+94771234567")]       // country code not accepted
    [InlineData("077 123 4567")]       // spaces not allowed
    [InlineData("077-123-456")]        // dashes not allowed
    [InlineData("077ABC4567")]         // letters not allowed
    [InlineData(null)]                 // null must not throw
    public void IsDialable_rejects_anything_else(string? phone)
        => Assert.False(PickupRequestValidation.IsDialable(phone));

    // --- Validate: description, preferred date and recurrence together. ---

    private static readonly DateTime ValidDate = DateTime.UtcNow.Date.AddDays(7);

    [Fact]
    public void Validate_accepts_a_well_formed_request()
    {
        var results = PickupRequestValidation
            .Validate("Two bags of plastic bottles", ValidDate, isRecurring: false, recurrenceInterval: null)
            .ToList();

        Assert.Empty(results);
    }

    [Fact]
    public void Validate_rejects_an_empty_description()
        => AssertHasError("description", PickupRequestValidation.Validate("", ValidDate, false, null));

    [Fact]
    public void Validate_rejects_a_too_short_description()
        => AssertHasError("description", PickupRequestValidation.Validate("abc", ValidDate, false, null));

    [Fact]
    public void Validate_rejects_a_too_long_description()
        => AssertHasError("description", PickupRequestValidation.Validate(new string('x', 1001), ValidDate, false, null));

    [Fact]
    public void Validate_rejects_a_missing_date()
        => AssertHasError("preferredDate", PickupRequestValidation.Validate("plastic bottles", default, false, null));

    [Fact]
    public void Validate_rejects_a_past_date()
        => AssertHasError("preferredDate",
            PickupRequestValidation.Validate("plastic bottles", DateTime.UtcNow.Date.AddDays(-1), false, null));

    [Fact]
    public void Validate_rejects_a_date_more_than_a_year_out()
        => AssertHasError("preferredDate",
            PickupRequestValidation.Validate("plastic bottles", DateTime.UtcNow.Date.AddDays(400), false, null));

    [Fact]
    public void Validate_rejects_recurring_without_an_interval()
        => AssertHasError("recurrenceInterval",
            PickupRequestValidation.Validate("plastic bottles", ValidDate, isRecurring: true, recurrenceInterval: ""));

    [Fact]
    public void Validate_rejects_an_unknown_interval()
        => AssertHasError("recurrenceInterval",
            PickupRequestValidation.Validate("plastic bottles", ValidDate, isRecurring: true, recurrenceInterval: "Monthly"));

    [Theory]
    [InlineData("Weekly")]
    [InlineData("Bi-weekly")]
    [InlineData("weekly")]   // case-insensitive
    public void Validate_accepts_allowed_intervals(string interval)
    {
        var results = PickupRequestValidation
            .Validate("plastic bottles", ValidDate, isRecurring: true, recurrenceInterval: interval)
            .ToList();

        Assert.Empty(results);
    }

    private static void AssertHasError(string expectedMember, IEnumerable<System.ComponentModel.DataAnnotations.ValidationResult> results)
    {
        Assert.Contains(results, r => r.MemberNames.Contains(expectedMember));
    }
}
