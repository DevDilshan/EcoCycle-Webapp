using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;

namespace backend.Services;

// A dashboard opens several authenticated requests together. MemoryCache's
// GetOrCreateAsync does not coalesce concurrent misses, so share the lookup.
public sealed class ProfileRoleCache(IMemoryCache cache)
{
    private readonly ConcurrentDictionary<Guid, Lazy<Task<string>>> _pending = new();

    public Task<string> GetAsync(Guid userId, Func<Task<string>> loadRole)
    {
        if (cache.TryGetValue<string>($"role:{userId}", out var role))
            return Task.FromResult(role!);

        return _pending.GetOrAdd(userId, id => new Lazy<Task<string>>(
            () => LoadAsync(id, loadRole))).Value;
    }

    private async Task<string> LoadAsync(Guid userId, Func<Task<string>> loadRole)
    {
        try
        {
            // A previous lookup can complete between the cache check and GetOrAdd.
            if (cache.TryGetValue<string>($"role:{userId}", out var cached))
                return cached!;

            var role = await loadRole();
            cache.Set($"role:{userId}", role, TimeSpan.FromMinutes(5));
            return role;
        }
        finally
        {
            // Failed lookups are not cached; the next request can try again.
            _pending.TryRemove(userId, out _);
        }
    }
}
