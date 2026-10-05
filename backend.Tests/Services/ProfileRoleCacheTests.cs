using backend.Services;
using Microsoft.Extensions.Caching.Memory;

namespace backend.Tests.Services;

public class ProfileRoleCacheTests
{
    [Fact]
    public async Task ConcurrentRequestsShareOneLookupAndReuseCachedRole()
    {
        using var memory = new MemoryCache(new MemoryCacheOptions());
        var cache = new ProfileRoleCache(memory);
        var userId = Guid.NewGuid();
        var result = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var calls = 0;
        Task<string> Load() { Interlocked.Increment(ref calls); return result.Task; }

        var requests = Enumerable.Range(0, 30).Select(_ => cache.GetAsync(userId, Load)).ToArray();
        Assert.Equal(1, calls);
        result.SetResult("admin");
        Assert.All(await Task.WhenAll(requests), role => Assert.Equal("admin", role));
        Assert.Equal("admin", await cache.GetAsync(userId, Load));
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task FailedLookupCanRetryWithoutGrantingOrCachingARole()
    {
        using var memory = new MemoryCache(new MemoryCacheOptions());
        var cache = new ProfileRoleCache(memory);
        var userId = Guid.NewGuid();
        await Assert.ThrowsAsync<InvalidOperationException>(() => cache.GetAsync(userId,
            () => Task.FromException<string>(new InvalidOperationException("Database unavailable"))));
        Assert.Equal("collector", await cache.GetAsync(userId, () => Task.FromResult("collector")));
    }

    [Fact]
    public async Task RolesAreCachedSeparatelyForEachUserAndReloadAfterExpiry()
    {
        using var memory = new MemoryCache(new MemoryCacheOptions());
        var cache = new ProfileRoleCache(memory);
        var adminId = Guid.NewGuid();
        var residentId = Guid.NewGuid();
        Assert.Equal("admin", await cache.GetAsync(adminId, () => Task.FromResult("admin")));
        Assert.Equal("resident", await cache.GetAsync(residentId, () => Task.FromResult("resident")));
        memory.Remove($"role:{adminId}");
        Assert.Equal("resident", await cache.GetAsync(adminId, () => Task.FromResult("resident")));
    }
}
