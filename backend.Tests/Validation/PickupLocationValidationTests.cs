using backend.Validation;

namespace backend.Tests.Validation;

// Pure unit tests for the pickup-pin coordinate rules added with the location
// feature. The pin is optional, but when given it must be a sane, complete,
// in-range pair -- a collector is routed to it.
public class PickupLocationValidationTests
{
    [Fact]
    public void Validate_allows_no_pin_at_all()
    {
        // Both null: the resident did not drop a pin, which is allowed.
        var results = PickupLocationValidation.Validate(null, null).ToList();
        Assert.Empty(results);
    }

    [Fact]
    public void Validate_accepts_a_valid_pin()
    {
        // Colombo, roughly. A real, in-range pair.
        var results = PickupLocationValidation.Validate(6.9271, 79.8612).ToList();
        Assert.Empty(results);
    }

    [Theory]
    [InlineData(6.9271, null)]   // latitude without longitude
    [InlineData(null, 79.8612)]  // longitude without latitude
    public void Validate_rejects_half_a_pin(double? lat, double? lng)
    {
        var results = PickupLocationValidation.Validate(lat, lng).ToList();
        Assert.Contains(results, r => r.ErrorMessage!.Contains("both"));
    }

    [Theory]
    [InlineData(90.001)]
    [InlineData(-90.001)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void Validate_rejects_out_of_range_latitude(double lat)
    {
        var results = PickupLocationValidation.Validate(lat, 79.8612).ToList();
        Assert.Contains(results, r => r.MemberNames.Contains("Latitude"));
    }

    [Theory]
    [InlineData(180.001)]
    [InlineData(-180.001)]
    [InlineData(double.NaN)]
    [InlineData(double.NegativeInfinity)]
    public void Validate_rejects_out_of_range_longitude(double lng)
    {
        var results = PickupLocationValidation.Validate(6.9271, lng).ToList();
        Assert.Contains(results, r => r.MemberNames.Contains("Longitude"));
    }

    [Theory]
    [InlineData(90.0, 180.0)]
    [InlineData(-90.0, -180.0)]
    public void Validate_accepts_the_range_boundaries(double lat, double lng)
    {
        var results = PickupLocationValidation.Validate(lat, lng).ToList();
        Assert.Empty(results);
    }
}
