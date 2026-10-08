using backend.DTOs;
using backend.Validation;

namespace backend.Tests.Validation;

public class BoundaryReferenceTests
{
    [Fact]
    public void OnlySupportedConsistentReferencesWithAnOutlineAndReviewAreAccepted()
    {
        var dto = new CreateZoneDto { Name = "Malabe", BoundaryGeoJson = "{}", ConfirmCollectionCoverage = true,
            BoundaryReference = new BoundaryReferenceDto { DatasetId = "lka-cod-ab-v03", AreaCode = "LK1124010", AreaName = "Malabe", AdministrativeLevel = 4 } };
        Assert.Null(BoundaryReference.Validate(dto));
        dto.BoundaryReference.AdministrativeLevel = 3;
        Assert.NotNull(BoundaryReference.Validate(dto));
        dto.BoundaryReference.AdministrativeLevel = 4;
        dto.BoundaryReference.DatasetId = "unknown";
        Assert.NotNull(BoundaryReference.Validate(dto));
        dto.BoundaryReference.DatasetId = "lka-cod-ab-v03";
        dto.BoundaryGeoJson = null;
        Assert.NotNull(BoundaryReference.Validate(dto));
        dto.BoundaryReference = null;
        Assert.Null(BoundaryReference.Validate(dto));
    }
}
