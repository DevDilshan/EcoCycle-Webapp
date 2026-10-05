using System.Diagnostics;
using backend.Data;
using backend.Models;
using backend.Tests.Database;
using Microsoft.EntityFrameworkCore;
using Xunit.Abstractions;

namespace backend.Tests.Performance;

// Database response-time measurement against a real PostgreSQL database: seed a
// realistic number of pickups, then time a representative resident list query
// over many iterations and report the percentiles. Skips when no test server is
// available (CI-safe). The assertion is a generous ceiling; the figures matter
// more than the pass/fail.
[Collection("Postgres")]
public class PickupDatabasePerformanceTests
{
    private readonly PostgresFixture _pg;
    private readonly ITestOutputHelper _output;

    public PickupDatabasePerformanceTests(PostgresFixture pg, ITestOutputHelper output)
    {
        _pg = pg;
        _output = output;
    }

    [SkippableFact]
    public async Task Resident_list_query_stays_responsive_over_many_reads()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        const int seedRows = 200;
        const int iterations = 50;

        var resident = await _pg.AddProfileAsync();
        await SeedPickupsAsync(resident, seedRows);

        // Warm up: the first query pays for the plan cache and connection.
        await using (var warm = _pg.NewContext())
            await QueryAsync(warm, resident);

        var latencies = new List<double>(iterations);
        for (var i = 0; i < iterations; i++)
        {
            await using var db = _pg.NewContext();
            var sw = Stopwatch.StartNew();
            var rows = await QueryAsync(db, resident);
            sw.Stop();
            latencies.Add(sw.Elapsed.TotalMilliseconds);
            Assert.Equal(20, rows); // the page size, so the query really ran
        }

        latencies.Sort();
        _output.WriteLine($"=== resident list query ({seedRows} rows seeded, {iterations} reads) ===");
        _output.WriteLine($"latency ms: p50={Pct(latencies, 50):F2}  p95={Pct(latencies, 95):F2}  " +
                          $"max={latencies[^1]:F2}  avg={latencies.Average():F2}");

        Assert.True(Pct(latencies, 95) < 500,
            $"p95 {Pct(latencies, 95):F1}ms exceeded the 500ms ceiling.");
    }

    private static Task<int> QueryAsync(ApplicationDbContext db, Guid resident) =>
        db.PickupRequests
            .AsNoTracking()
            .Where(p => p.ResidentId == resident)
            .OrderByDescending(p => p.CreatedAt)
            .Take(20)
            .CountAsync();

    private async Task SeedPickupsAsync(Guid resident, int count)
    {
        await using var db = _pg.NewContext();
        for (var i = 0; i < count; i++)
        {
            db.PickupRequests.Add(new PickupRequest
            {
                ResidentId = resident,
                Description = $"load row {i}",
                PreferredDate = DateTime.SpecifyKind(DateTime.Today.AddDays(1), DateTimeKind.Utc),
                Status = PickupStatus.Pending,
                CreatedAt = DateTime.UtcNow.AddMinutes(-i),
            });
        }
        await db.SaveChangesAsync();
    }

    private static double Pct(IReadOnlyList<double> sorted, int p)
    {
        if (sorted.Count == 0) return 0;
        var rank = (int)Math.Ceiling(p / 100.0 * sorted.Count) - 1;
        return sorted[Math.Clamp(rank, 0, sorted.Count - 1)];
    }
}
