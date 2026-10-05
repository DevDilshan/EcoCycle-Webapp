using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using backend.Tests.Integration;
using Xunit.Abstractions;

namespace backend.Tests.Performance;

public class ComplaintsApiPerformanceTests : IClassFixture<ComplaintsApiFactory>
{
    private readonly ComplaintsApiFactory _factory;
    private readonly ITestOutputHelper _output;

    public ComplaintsApiPerformanceTests(ComplaintsApiFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
    }

    [Fact]
    public async Task GetList_handles_concurrent_reads_for_residents()
    {
        const int totalRequests = 200;
        const int concurrency = 20;
        var client = Client("resident");

        var (latencies, failures) = await RunLoadAsync(totalRequests, concurrency, async () =>
        {
            var r = await client.GetAsync("/api/complaints");
            return r.StatusCode == HttpStatusCode.OK;
        });

        Report("GET /api/complaints", totalRequests, concurrency, latencies, failures);
        Assert.Equal(0, failures);
    }

    private HttpClient Client(string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        client.DefaultRequestHeaders.Add(TestAuthHandler.SubHeader, Guid.NewGuid().ToString());
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

    private void Report(string label, int total, int concurrency, List<double> latencies, int failures)
    {
        _output.WriteLine($"=== {label} === failures={failures} avg={(latencies.Count > 0 ? latencies.Average() : 0):F1}ms");
    }
}
