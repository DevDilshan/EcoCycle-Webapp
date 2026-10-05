using backend.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace backend.Tests.Database;

// Integration tests against a real PostgreSQL database: the migration applies,
// the column constraints bite, timestamptz behaves as Npgsql demands, and a
// transaction rolls back. These are the behaviours the in-memory provider
// cannot reproduce. Each test Skip()s when no test server is available.
[Collection("Postgres")]
public class PickupRequestDatabaseTests
{
    private readonly PostgresFixture _pg;

    public PickupRequestDatabaseTests(PostgresFixture pg) => _pg = pg;

    // --- Migrations ---

    [SkippableFact]
    public async Task Migration_creates_ContactPhone_as_nullable_varchar20()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var (dataType, maxLength, isNullable) = await ColumnInfoAsync("PickupRequests", "ContactPhone");

        Assert.Equal("character varying", dataType);
        Assert.Equal(20, maxLength);
        Assert.Equal("YES", isNullable);
    }

    [SkippableFact]
    public async Task Migration_creates_nullable_coordinate_columns()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var lat = await ColumnInfoAsync("PickupRequests", "Latitude");
        var lng = await ColumnInfoAsync("PickupRequests", "Longitude");

        Assert.Equal("double precision", lat.DataType);
        Assert.Equal("YES", lat.IsNullable);
        Assert.Equal("double precision", lng.DataType);
        Assert.Equal("YES", lng.IsNullable);
    }

    // --- Column constraint ---

    [SkippableFact]
    public async Task ContactPhone_longer_than_20_chars_is_rejected_by_the_column()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var residentId = await _pg.AddProfileAsync();
        await using var db = _pg.NewContext();
        db.PickupRequests.Add(NewPickup(residentId, contactPhone: new string('9', 21)));

        // Postgres raises 22001 (string_data_right_truncation); EF wraps it.
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        var pg = Assert.IsType<PostgresException>(ex.InnerException);
        Assert.Equal("22001", pg.SqlState);
    }

    // --- timestamptz behaviour ---

    [SkippableFact]
    public async Task PreferredDate_with_unspecified_kind_is_rejected_by_timestamptz()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var residentId = await _pg.AddProfileAsync();
        await using var db = _pg.NewContext();
        var pickup = NewPickup(residentId);
        // The bug this guards: a non-UTC DateTime against a timestamptz column.
        pickup.PreferredDate = DateTime.SpecifyKind(DateTime.Today.AddDays(1), DateTimeKind.Unspecified);
        db.PickupRequests.Add(pickup);

        var ex = await Record.ExceptionAsync(() => db.SaveChangesAsync());

        Assert.NotNull(ex);
        var message = ex!.InnerException?.Message ?? ex.Message;
        Assert.Contains("Kind", message); // "...Kind=Unspecified...Kind=Utc"
    }

    [SkippableFact]
    public async Task A_valid_pickup_round_trips_and_reads_back_as_utc()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var residentId = await _pg.AddProfileAsync();
        var id = Guid.NewGuid();

        await using (var db = _pg.NewContext())
        {
            var pickup = NewPickup(residentId);
            pickup.Id = id;
            db.PickupRequests.Add(pickup);
            await db.SaveChangesAsync();
        }

        await using (var db = _pg.NewContext())
        {
            var saved = await db.PickupRequests.SingleAsync(p => p.Id == id);
            Assert.Equal(DateTimeKind.Utc, saved.PreferredDate.Kind);
            Assert.Equal(DateTimeKind.Utc, saved.CreatedAt.Kind);
        }
    }

    // --- Transaction behaviour ---

    [SkippableFact]
    public async Task A_rolled_back_transaction_leaves_no_row()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var residentId = await _pg.AddProfileAsync();
        var id = Guid.NewGuid();

        await using (var db = _pg.NewContext())
        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            var pickup = NewPickup(residentId);
            pickup.Id = id;
            db.PickupRequests.Add(pickup);
            await db.SaveChangesAsync();
            await tx.RollbackAsync(); // deliberately do not commit
        }

        await using (var db = _pg.NewContext())
        {
            Assert.False(await db.PickupRequests.AnyAsync(p => p.Id == id));
        }
    }

    // --- helpers ---

    private static PickupRequest NewPickup(Guid residentId, string? contactPhone = "0771234567") => new()
    {
        ResidentId = residentId,
        Description = "plastic bottles",
        PreferredDate = DateTime.SpecifyKind(DateTime.Today.AddDays(1), DateTimeKind.Utc),
        Status = PickupStatus.Pending,
        ContactPhone = contactPhone,
        CreatedAt = DateTime.UtcNow,
    };

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
        var dataType = reader.GetString(0);
        int? maxLength = reader.IsDBNull(1) ? null : reader.GetInt32(1);
        var isNullable = reader.GetString(2);
        return (dataType, maxLength, isNullable);
    }
}
