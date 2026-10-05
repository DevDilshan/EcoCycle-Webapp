using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using backend.Models;
using backend.Tests.Integration;
using Xunit.Abstractions;

namespace backend.Tests.Performance;

// Performance smoke tests for the pickup API: fire many requests concurrently
// through the real ASP.NET Core pipeline (InMemory DB, stubbed agent) and
// report response-time percentiles, throughput and the success/failure rate.
//
// These run in-process over the TestServer, so the numbers exclude network and
// are optimistic in absolute terms -- their value is a repeatable measurement
// and a guard that the API stays correct and 100% successful under concurrency,
// not a production benchmark. Latency is asserted only against a generous
// ceiling so the test does not flake on a slow CI runner; the real figures are
// printed to the test output.
public class PickupApiPerformanceTests : IClassFixture<PickupApiFactory>
{
    private readonly PickupApiFactory _factory;
    private readonly ITestOutputHelper _output;

    public PickupApiPerformanceTests(PickupApiFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
    }

    private HttpClient ResidentClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, "resident");
        client.DefaultRequestHeaders.Add(TestAuthHandler.SubHeader, Guid.NewGuid().ToString());
        return client;
    }

    [Fact]
    public async Task GetList_sustains_concurrent_reads_at_100_percent_success()
    {
        const int totalRequests = 300;
        const int concurrency = 25;
        var client = ResidentClient();

        var (latencies, failures) = await RunLoadAsync(
            totalRequests, concurrency,
            async () =>
            {
                var r = await client.GetAsync("/api/pickuprequests");
                return r.StatusCode == HttpStatusCode.OK;
            });

        Report("GET /api/pickuprequests", totalRequests, concurrency, latencies, failures);

        Assert.Equal(0, failures);                       // success/failure rate
        Assert.True(Percentile(latencies, 95) < 2000,    // generous ceiling
            $"p95 {Percentile(latencies, 95):F1}ms exceeded the 2000ms ceiling.");
    }

    [Fact]
    public async Task Create_handles_concurrent_writes_without_errors()
    {
        const int totalRequests = 60;
        const int concurrency = 10;

        var zoneId = Guid.NewGuid();
        await _factory.SeedAsync(db =>
        {
            db.Zones.Add(new Zone { Id = zoneId, Name = "Perf", Description = "p", IsActive = true });
            return Task.CompletedTask;
        });

        var client = ResidentClient();
        object Body() => new
        {
            zoneId,
            description = "Concurrent load-test pickup",
            address = "1 Load Test Road, Dehiwala",
            contactPhone = "0771234567",
            preferredDate = DateTime.UtcNow.Date.AddDays(3),
        };

        var (latencies, failures) = await RunLoadAsync(
            totalRequests, concurrency,
            async () =>
            {
                var r = await client.PostAsJsonAsync("/api/pickuprequests", Body());
                return r.StatusCode == HttpStatusCode.Created;
            });

        Report("POST /api/pickuprequests", totalRequests, concurrency, latencies, failures);

        Assert.Equal(0, failures);
    }

    // --- load harness ---

    private static async Task<(List<double> Latencies, int Failures)> RunLoadAsync(
        int total, int concurrency, Func<Task<bool>> request)
    {
        var latencies = new ConcurrentBag<double>();
        var failures = 0;
        using var gate = new SemaphoreSlim(concurrency);

        var tasks = Enumerable.Range(0, total).Select(async _ =>
        {
            await gate.WaitAsync();
            try
            {
                var sw = Stopwatch.StartNew();
                var ok = await request();
                sw.Stop();
                latencies.Add(sw.Elapsed.TotalMilliseconds);
                if (!ok) Interlocked.Increment(ref failures);
            }
            finally
            {
                gate.Release();
            }
        });

        await Task.WhenAll(tasks);
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
        var wall = latencies.Sum();
        var successRate = total == 0 ? 0 : 100.0 * (total - failures) / total;
        _output.WriteLine($"=== {label} ===");
        _output.WriteLine($"requests={total}  concurrency={concurrency}  failures={failures}  success={successRate:F1}%");
        _output.WriteLine($"latency ms: p50={Percentile(latencies, 50):F1}  " +
                          $"p95={Percentile(latencies, 95):F1}  p99={Percentile(latencies, 99):F1}  " +
                          $"max={latencies.Max():F1}  avg={latencies.Average():F1}");
    }
}
