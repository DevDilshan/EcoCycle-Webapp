using backend.Validation;

namespace backend.Tests.Validation;

// Pure unit tests for the shared pickup-request validation rules. No database,
// no service -- just the rules a resident's input must pass. These back the
// "validation" evidence for the backend testing requirement.
public class PickupRequestValidationTests
{
    // --- IsDialable: a contact number the crew could actually ring. ---
    // 9..15 digits (E.164), a leading + allowed, spaces/dashes/parens ignored.

    [Theory]
    [InlineData("0771234567")]        // local 10-digit mobile
    [InlineData("+94771234567")]      // international form of the same number
    [InlineData("077 123 4567")]      // spaces are separators, not digits
    [InlineData("077-123-4567")]      // dashes too
    [InlineData("(077) 123 4567")]    // parens too
    [InlineData("123456789")]         // exactly 9 digits -- lower bound
    [InlineData("123456789012345")]   // exactly 15 digits -- upper bound
    public void IsDialable_accepts_valid_numbers(string phone)
        => Assert.True(PickupRequestValidation.IsDialable(phone));

    [Theory]
    [InlineData("")]                   // empty
    [InlineData("   ")]                // whitespace only
    [InlineData("12345678")]           // 8 digits -- below the floor
    [InlineData("1234567890123456")]   // 16 digits -- above the ceiling
    [InlineData("077ABC4567")]         // letters are not separators
    [InlineData("077+1234567")]        // a plus anywhere but the front is malformed
    [InlineData(null)]                 // null must not throw
    public void IsDialable_rejects_bad_numbers(string? phone)
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
