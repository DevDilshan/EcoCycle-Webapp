using backend.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace backend.Tests.Database;

[Collection("Postgres")]
public class RewardsDatabaseTests
{
    private readonly PostgresFixture _pg;

    public RewardsDatabaseTests(PostgresFixture pg) => _pg = pg;

    [SkippableFact]
    public async Task Migration_creates_Reason_as_varchar500()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var (dataType, maxLength, _) = await ColumnInfoAsync("RewardPoints", "Reason");
        Assert.Equal("character varying", dataType);
        Assert.Equal(500, maxLength);
    }

    [SkippableFact]
    public async Task Reason_longer_than_500_chars_is_rejected()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var residentId = await _pg.AddProfileAsync();
        await using var db = _pg.NewContext();
        db.RewardPoints.Add(new RewardPoint
        {
            ResidentId = residentId,
            PointsEarned = 5,
            Reason = new string('x', 501),
            CreatedAt = DateTime.UtcNow,
        });

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        var pg = Assert.IsType<PostgresException>(ex.InnerException);
        Assert.Equal("22001", pg.SqlState);
    }

    [SkippableFact]
    public async Task Reward_point_row_round_trips()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var residentId = await _pg.AddProfileAsync();
        var id = Guid.NewGuid();

        await using (var db = _pg.NewContext())
        {
            db.RewardPoints.Add(new RewardPoint
            {
                Id = id,
                ResidentId = residentId,
                PointsEarned = 10,
                Reason = "Recyclable collection",
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        await using (var db = _pg.NewContext())
        {
            var saved = await db.RewardPoints.SingleAsync(r => r.Id == id);
            Assert.Equal(DateTimeKind.Utc, saved.CreatedAt.Kind);
            Assert.Equal(10, saved.PointsEarned);
        }
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
