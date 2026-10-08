using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using backend.Models;
using backend.Tests.Integration;
using Xunit.Abstractions;

namespace backend.Tests.Performance;

public class RouteApiPerformanceTests : IClassFixture<RouteApiFactory>
{
    private readonly RouteApiFactory _factory;
    private readonly ITestOutputHelper _output;

    public RouteApiPerformanceTests(RouteApiFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
    }

    [Fact]
    public async Task GetTodayRoute_sustains_concurrent_reads_at_full_success()
    {
        var collectorId = Guid.NewGuid();
        await _factory.SeedAsync(db =>
        {
            db.Profiles.Add(new Profile
            {
                Id = collectorId,
                Email = "col@perf.local",
                Role = "collector",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
            return Task.CompletedTask;
        });

        const int totalRequests = 200;
        const int concurrency = 20;
        var client = Client("collector", collectorId);

        var (latencies, failures) = await RunLoadAsync(totalRequests, concurrency, async () =>
        {
            var r = await client.GetAsync($"/api/routes/{collectorId}/today");
            return r.StatusCode == HttpStatusCode.OK;
        });

        Report($"GET /api/routes/{collectorId}/today", totalRequests, concurrency, latencies, failures);
        Assert.Equal(0, failures);
        Assert.True(Percentile(latencies, 95) < 2000);
    }

    private HttpClient Client(string role, Guid sub)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        client.DefaultRequestHeaders.Add(TestAuthHandler.SubHeader, sub.ToString());
        return client;
    }

    private static async Task<(List<double> Latencies, int Failures)> RunLoadAsync(
        int total, int concurrency, Func<Task<bool>> request)
    {
        var latencies = new ConcurrentBag<double>();
        var failures = 0;
        using var gate = new SemaphoreSlim(concurrency);

        await Task.WhenAll(Enumerable.Range(0, total).Select(async _ =>
        {
            await gate.WaitAsync();
            try
            {
                var sw = Stopwatch.StartNew();
                if (!await request()) Interlocked.Increment(ref failures);
                sw.Stop();
                latencies.Add(sw.Elapsed.TotalMilliseconds);
            }
            finally { gate.Release(); }
        }));

        return (latencies.ToList(), failures);
    }

    private static double Percentile(IReadOnlyList<double> values, int percentile)
    {
        if (values.Count == 0) return 0;
        var sorted = values.OrderBy(v => v).ToList();
        var rank = (int)Math.Ceiling(percentile / 100.0 * sorted.Count) - 1;
        return sorted[Math.Clamp(rank, 0, sorted.Count - 1)];
    }

    private void Report(string label, int total, int concurrency, List<double> latencies, int failures)
    {
        var successRate = total == 0 ? 0 : 100.0 * (total - failures) / total;
        _output.WriteLine($"=== {label} ===");
        _output.WriteLine($"requests={total}  concurrency={concurrency}  failures={failures}  success={successRate:F1}%");
        if (latencies.Count > 0)
            _output.WriteLine($"latency ms: p50={Percentile(latencies, 50):F1}  p95={Percentile(latencies, 95):F1}  max={latencies.Max():F1}");
    }
}
