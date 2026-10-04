using System.ComponentModel.DataAnnotations;
using backend.DTOs;

namespace backend.Tests.Services;

// The declarative half of zone validation: what the DTO refuses before the
// service is ever reached.
public class ZoneDtoValidationTests
{
    private static List<ValidationResult> Validate(CreateZoneDto dto)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(dto, new ValidationContext(dto), results, validateAllProperties: true);
        return results;
    }

    private static CreateZoneDto Valid() => new()
    {
        Name = "Dehiwala",
        Latitude = 6.8513,
        Longitude = 79.8660,
        CollectionDays = [1, 0],
    };

    [Fact]
    public void A_valid_zone_passes()
    {
        Assert.Empty(Validate(Valid()));
    }

    [Fact]
    public void A_blank_name_is_refused()
    {
        // By [Required], which treats a whitespace-only string as missing. Worth
        // pinning down: the behaviour is easy to assume the other way round, and
        // when a property attribute fails, IValidatableObject.Validate is never
        // called at all -- so a check written there for this case is dead code.
        var dto = Valid();
        dto.Name = "   ";

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("required"));
    }

    [Fact]
    public void A_one_character_name_is_refused()
    {
        var dto = Valid();
        dto.Name = "D";

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("at least 2 characters"));
    }

    [Theory]
    [InlineData(91, 79.8)]
    [InlineData(-91, 79.8)]
    [InlineData(6.8, 181)]
    [InlineData(6.8, -181)]
    public void A_coordinate_outside_the_world_is_refused(double lat, double lng)
    {
        var dto = Valid();
        dto.Latitude = lat;
        dto.Longitude = lng;

        Assert.NotEmpty(Validate(dto));
    }

    [Fact]
    public void A_latitude_without_a_longitude_is_refused()
    {
        // One alone is not a location, and such a zone was silently treated as
        // unplaced -- which looked like the value had failed to save.
        var dto = Valid();
        dto.Longitude = null;

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("both a latitude and a longitude"));
    }

    [Fact]
    public void No_coordinates_at_all_is_allowed()
    {
        // A zone with no pin is still perfectly routable.
        var dto = Valid();
        dto.Latitude = null;
        dto.Longitude = null;

        Assert.Empty(Validate(dto));
    }

    [Fact]
    public void A_day_outside_the_week_is_refused()
    {
        // Rejected rather than quietly dropped: the service filters these out, so
        // a client sending 7 got a zone with no collection days and no reason why.
        var dto = Valid();
        dto.CollectionDays = [1, 7];

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("0 (Sunday) to 6 (Saturday)"));
    }

    [Fact]
    public void An_empty_collector_id_is_refused()
    {
        var dto = Valid();
        dto.AssignedCollectorId = Guid.Empty;

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("leave the zone unassigned"));
    }

    [Fact]
    public void An_unassigned_zone_is_allowed()
    {
        var dto = Valid();
        dto.AssignedCollectorId = null;

        Assert.Empty(Validate(dto));
    }
}

// The same for booking a stop: ids that [Required] cannot catch, and dates.
public class RouteDtoValidationTests
{
    private static List<ValidationResult> Validate(CreateRouteAssignmentDto dto)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(dto, new ValidationContext(dto), results, validateAllProperties: true);
        return results;
    }

    private static CreateRouteAssignmentDto Valid() => new()
    {
        PickupRequestId = Guid.NewGuid(),
        CollectorId = Guid.NewGuid(),
        ZoneId = Guid.NewGuid(),
        ScheduledDate = DateTime.UtcNow.Date.AddDays(1),
    };

    [Fact]
    public void A_valid_booking_passes()
    {
        Assert.Empty(Validate(Valid()));
    }

    [Fact]
    public void An_empty_pickup_id_is_refused()
    {
        // [Required] is a no-op on a non-nullable Guid: an omitted id arrives as
        // Guid.Empty and reached the database as a key to nothing.
        var dto = Valid();
        dto.PickupRequestId = Guid.Empty;

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("pickup request is required"));
    }

    [Fact]
    public void An_empty_collector_id_is_refused()
    {
        var dto = Valid();
        dto.CollectorId = Guid.Empty;

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("collector is required"));
    }

    [Fact]
    public void An_empty_zone_id_is_refused()
    {
        var dto = Valid();
        dto.ZoneId = Guid.Empty;

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("zone is required"));
    }

    [Fact]
    public void A_date_in_the_past_is_refused()
    {
        var dto = Valid();
        dto.ScheduledDate = DateTime.UtcNow.Date.AddDays(-1);

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("cannot be scheduled in the past"));
    }

    [Fact]
    public void A_date_years_away_is_refused()
    {
        var dto = Valid();
        dto.ScheduledDate = DateTime.UtcNow.Date.AddYears(3);

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("within the next 12 months"));
    }

    [Fact]
    public void A_missing_date_is_refused()
    {
        var dto = Valid();
        dto.ScheduledDate = default;

        Assert.Contains(Validate(dto), r => r.ErrorMessage!.Contains("scheduled date is required"));
    }
}
