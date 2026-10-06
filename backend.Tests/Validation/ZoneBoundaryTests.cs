using System.Text.Json;
using backend.Validation;

namespace backend.Tests.Validation;

public class ZoneBoundaryTests
{
    [Fact]
    public void PublishedMalabeOutlineMatchesTheMobileAndWebPinPolicy()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "sri-lanka-boundary-sample.json")));
        var boundary = ZoneBoundary.Parse(doc.RootElement.GetProperty("geometry").GetRawText())!;
        foreach (var sample in doc.RootElement.GetProperty("cases").EnumerateArray())
            Assert.Equal(sample.GetProperty("inside").GetBoolean(), boundary.Contains(sample.GetProperty("latitude").GetDouble(), sample.GetProperty("longitude").GetDouble()));
    }
    [Fact]
    public void SharedCasesMatchTheWebAndFlutterEdgePolicy()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "zone-boundaries.json")));
        var boundary = ZoneBoundary.Parse(doc.RootElement.GetProperty("geometry").GetRawText())!;
        foreach (var sample in doc.RootElement.GetProperty("cases").EnumerateArray())
            Assert.Equal(sample.GetProperty("inside").GetBoolean(), boundary.Contains(sample.GetProperty("latitude").GetDouble(), sample.GetProperty("longitude").GetDouble()));
        var center = boundary.MapCenter();
        Assert.True(boundary.Contains(center.Latitude, center.Longitude));
    }

    [Theory]
    [InlineData("{\"type\":\"Point\",\"coordinates\":[79,6]}")]
    [InlineData("{\"type\":\"Polygon\",\"coordinates\":[[[79,6],[80,6],[80,7],[79,7]]]}")]
    [InlineData("{\"type\":\"Polygon\",\"coordinates\":[[[79,6],[80,7],[79,7],[80,6],[79,6]]]}")]
    [InlineData("{\"type\":\"Polygon\",\"coordinates\":[[[79,6],[80,6],[81,6],[79,6]]]}")]
    [InlineData("{\"type\":\"Polygon\",\"coordinates\":[[[181,6],[182,6],[182,7],[181,6]]]}")]
    [InlineData("{}")]
    public void RejectsUnsupportedOpenCrossedFlatOrInvalidRings(string json) => Assert.Throws<ArgumentException>(() => ZoneBoundary.Parse(json));

    [Fact]
    public void LegacyZoneHasNoBoundary() => Assert.Null(ZoneBoundary.Parse(null));
}
