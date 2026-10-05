using backend.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace backend.Tests.Database;

[Collection("Postgres")]
public class RouteDispatchDatabaseTests
{
    private readonly PostgresFixture _pg;

    public RouteDispatchDatabaseTests(PostgresFixture pg) => _pg = pg;

    [SkippableFact]
    public async Task Migration_creates_ScheduledDate_as_timestamptz()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var (dataType, _, _) = await ColumnInfoAsync("RouteAssignments", "ScheduledDate");
        Assert.Equal("timestamp with time zone", dataType);
    }

    [SkippableFact]
    public async Task Route_assignment_round_trips_with_utc_timestamps()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var residentId = await _pg.AddProfileAsync();
        var collectorId = await AddCollectorProfileAsync();
        var zoneId = Guid.NewGuid();
        var pickupId = Guid.NewGuid();
        var routeId = Guid.NewGuid();

        await using (var db = _pg.NewContext())
        {
            db.Zones.Add(new Zone { Id = zoneId, Name = "Test Zone", Description = "d", IsActive = true });
            db.PickupRequests.Add(new PickupRequest
            {
                Id = pickupId,
                ResidentId = residentId,
                Description = "bags",
                PreferredDate = DateTime.UtcNow.AddDays(1),
                Status = PickupStatus.Classified,
                CreatedAt = DateTime.UtcNow,
            });
            db.RouteAssignments.Add(new RouteAssignment
            {
                Id = routeId,
                PickupRequestId = pickupId,
                CollectorId = collectorId,
                ZoneId = zoneId,
                ScheduledDate = DateTime.UtcNow.Date,
                CompletionStatus = RouteCompletionStatus.Pending,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        await using (var db = _pg.NewContext())
        {
            var saved = await db.RouteAssignments.SingleAsync(r => r.Id == routeId);
            Assert.Equal(DateTimeKind.Utc, saved.ScheduledDate.Kind);
        }
    }

    [SkippableFact]
    public async Task Rolled_back_route_insert_leaves_no_row()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var residentId = await _pg.AddProfileAsync();
        var collectorId = await AddCollectorProfileAsync();
        var zoneId = Guid.NewGuid();
        var pickupId = Guid.NewGuid();
        var routeId = Guid.NewGuid();

        await using (var db = _pg.NewContext())
        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            db.Zones.Add(new Zone { Id = zoneId, Name = "Tx Zone", Description = "d", IsActive = true });
            db.PickupRequests.Add(new PickupRequest
            {
                Id = pickupId,
                ResidentId = residentId,
                Description = "bags",
                PreferredDate = DateTime.UtcNow.AddDays(1),
                Status = PickupStatus.Classified,
                CreatedAt = DateTime.UtcNow,
            });
            db.RouteAssignments.Add(new RouteAssignment
            {
                Id = routeId,
                PickupRequestId = pickupId,
                CollectorId = collectorId,
                ZoneId = zoneId,
                ScheduledDate = DateTime.UtcNow.Date,
                CompletionStatus = RouteCompletionStatus.Pending,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
            await tx.RollbackAsync();
        }

        await using (var db = _pg.NewContext())
            Assert.False(await db.RouteAssignments.AnyAsync(r => r.Id == routeId));
    }

    private async Task<Guid> AddCollectorProfileAsync()
    {
        var id = Guid.NewGuid();
        await using var conn = new NpgsqlConnection(_pg.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO public.profiles (id, email, role) VALUES ($1, $2, $3)";
        cmd.Parameters.AddWithValue(id);
        cmd.Parameters.AddWithValue($"{id:N}@collector.test");
        cmd.Parameters.AddWithValue("collector");
        await cmd.ExecuteNonQueryAsync();
        return id;
    }

    private async Task<(string DataType, int? MaxLength, string IsNullable)> ColumnInfoAsync(
        string table, string column)
    {
        await using var conn = new NpgsqlConnection(_pg.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT data_type, character_maximum_length, is_nullable " +
            "FROM information_schema.columns WHERE table_name = $1 AND column_name = $2";
        cmd.Parameters.AddWithValue(table);
        cmd.Parameters.AddWithValue(column);

        await using var reader = await cmd.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync(), $"Column {table}.{column} not found.");
        return (reader.GetString(0), reader.IsDBNull(1) ? null : reader.GetInt32(1), reader.GetString(2));
    }
}
