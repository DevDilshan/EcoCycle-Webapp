using System.Text.Json;

namespace backend.Validation;

/// <summary>Small, bounded GeoJSON service areas in WGS84 longitude/latitude order.</summary>
public sealed class ZoneBoundary
{
    public const int MaxLength = 64000;
    private const double Epsilon = 1e-10;
    private readonly List<List<List<Point>>> _polygons;
    private readonly record struct Point(double X, double Y);
    private ZoneBoundary(List<List<List<Point>>> polygons) => _polygons = polygons;

    public static ZoneBoundary? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        if (json.Length > MaxLength) throw new ArgumentException("Boundary data is too large (maximum 64 KB). Simplify it first.");
        try
        {
            using var doc = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 16 });
            var root = doc.RootElement;
            var type = root.GetProperty("type").GetString();
            var coordinates = root.GetProperty("coordinates");
            var shapes = type switch
            {
                "Polygon" => new[] { coordinates },
                "MultiPolygon" => coordinates.EnumerateArray().ToArray(),
                _ => throw new ArgumentException("Import a GeoJSON Polygon or MultiPolygon boundary.")
            };
            if (shapes.Length is < 1 or > 20) throw new ArgumentException("A boundary needs 1 to 20 polygons.");
            var count = 0;
            var polygons = new List<List<List<Point>>>();
            foreach (var shape in shapes)
            {
                var rings = new List<List<Point>>();
                foreach (var ringJson in shape.EnumerateArray())
                {
                    if (rings.Count >= 20) throw new ArgumentException("A polygon can have at most 20 rings.");
                    var ring = new List<Point>();
                    foreach (var position in ringJson.EnumerateArray())
                    {
                        if (++count > 1000) throw new ArgumentException("Simplify the boundary to at most 1,000 positions.");
                        if (position.GetArrayLength() != 2) throw new ArgumentException("Each position needs longitude and latitude only.");
                        var x = position[0].GetDouble();
                        var y = position[1].GetDouble();
                        if (!double.IsFinite(x) || !double.IsFinite(y) || x is < -180 or > 180 || y is < -90 or > 90)
                            throw new ArgumentException("Boundary coordinates must be valid longitude/latitude values.");
                        ring.Add(new Point(x, y));
                    }
                    ValidateRing(ring);
                    rings.Add(ring);
                }
                if (rings.Count == 0) throw new ArgumentException("A polygon needs an outer ring.");
                for (var h = 1; h < rings.Count; h++)
                {
                    if (InRing(rings[h][0], rings[0]) != 1 || Crosses(rings[h], rings[0]))
                        throw new ArgumentException("Boundary holes must sit strictly inside their outer ring.");
                    for (var previous = 1; previous < h; previous++)
                        if (Crosses(rings[h], rings[previous]) || InRing(rings[h][0], rings[previous]) != 0 || InRing(rings[previous][0], rings[h]) != 0)
                            throw new ArgumentException("Boundary holes must not touch or overlap.");
                }
                polygons.Add(rings);
            }
            return new ZoneBoundary(polygons);
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or KeyNotFoundException or FormatException or OverflowException)
        {
            throw new ArgumentException("Invalid GeoJSON boundary. Use a Polygon or MultiPolygon with closed coordinate rings.");
        }
    }

    // Outer edges are included; hole edges are excluded. This is shared by both clients.
    public bool Contains(double latitude, double longitude)
    {
        if (!double.IsFinite(latitude) || !double.IsFinite(longitude)) return false;
        var p = new Point(longitude, latitude);
        return _polygons.Any(rings => InRing(p, rings[0]) != 0 && rings.Skip(1).All(r => InRing(p, r) == 0));
    }

    public (double Latitude, double Longitude) MapCenter()
    {
        var points = _polygons.SelectMany(p => p[0]).ToList();
        var x = (points.Min(p => p.X) + points.Max(p => p.X)) / 2;
        var y = (points.Min(p => p.Y) + points.Max(p => p.Y)) / 2;
        if (Contains(y, x)) return (y, x);
        // Concave areas or holes can exclude the bounding-box centre. An outer
        // vertex is a safe label anchor; the map itself frames the whole outline.
        return (points[0].Y, points[0].X);
    }

    private static void ValidateRing(List<Point> r)
    {
        if (r.Count < 4 || r[0] != r[^1]) throw new ArgumentException("Close every ring and include at least three corners.");
        var area = 0d;
        for (var i = 0; i < r.Count - 1; i++)
        {
            if (r[i] == r[i + 1]) throw new ArgumentException("Remove repeated neighbouring corners.");
            if (Math.Abs(r[i].X - r[i + 1].X) > 180) throw new ArgumentException("Boundaries crossing the antimeridian are not supported.");
            area += r[i].X * r[i + 1].Y - r[i + 1].X * r[i].Y;
            for (var j = i + 2; j < r.Count - 1; j++)
                if (!(i == 0 && j == r.Count - 2) && Intersects(r[i], r[i + 1], r[j], r[j + 1]))
                    throw new ArgumentException("Boundary edges must not cross or touch each other.");
        }
        if (Math.Abs(area) < Epsilon) throw new ArgumentException("A boundary must enclose an area.");
    }

    private static double Turn(Point a, Point b, Point c) => (b.X - a.X) * (c.Y - a.Y) - (b.Y - a.Y) * (c.X - a.X);
    private static bool OnSegment(Point p, Point a, Point b) => Math.Abs(Turn(a, b, p)) <= Epsilon &&
        p.X >= Math.Min(a.X, b.X) - Epsilon && p.X <= Math.Max(a.X, b.X) + Epsilon &&
        p.Y >= Math.Min(a.Y, b.Y) - Epsilon && p.Y <= Math.Max(a.Y, b.Y) + Epsilon;
    private static bool Intersects(Point a, Point b, Point c, Point d) =>
        OnSegment(a, c, d) || OnSegment(b, c, d) || OnSegment(c, a, b) || OnSegment(d, a, b) ||
        (Turn(a, b, c) > 0 != Turn(a, b, d) > 0) && (Turn(c, d, a) > 0 != Turn(c, d, b) > 0);
    private static bool Crosses(List<Point> a, List<Point> b) =>
        Enumerable.Range(0, a.Count - 1).Any(i => Enumerable.Range(0, b.Count - 1).Any(j => Intersects(a[i], a[i + 1], b[j], b[j + 1])));
    private static int InRing(Point p, List<Point> ring)
    {
        var inside = false;
        for (var i = 0; i < ring.Count - 1; i++)
        {
            var a = ring[i]; var b = ring[i + 1];
            if (OnSegment(p, a, b)) return 2;
            if ((a.Y > p.Y) != (b.Y > p.Y) && p.X < (b.X - a.X) * (p.Y - a.Y) / (b.Y - a.Y) + a.X) inside = !inside;
        }
        return inside ? 1 : 0;
    }
}
