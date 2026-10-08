using backend.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace backend.Tests.Database;

[Collection("Postgres")]
public class ComplaintApprovalDatabaseTests
{
    private readonly PostgresFixture _pg;

    public ComplaintApprovalDatabaseTests(PostgresFixture pg) => _pg = pg;

    [SkippableFact]
    public async Task Migration_creates_Description_as_varchar2000()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var (dataType, maxLength, _) = await ColumnInfoAsync("Complaints", "Description");
        Assert.Equal("character varying", dataType);
        Assert.Equal(2000, maxLength);
    }

    [SkippableFact]
    public async Task Complaint_description_over_2000_chars_is_rejected()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var residentId = await _pg.AddProfileAsync();
        var pickupId = Guid.NewGuid();

        await using var db = _pg.NewContext();
        db.PickupRequests.Add(new PickupRequest
        {
            Id = pickupId,
            ResidentId = residentId,
            Description = "bags",
            PreferredDate = DateTime.UtcNow.AddDays(1),
            Status = PickupStatus.Completed,
            CreatedAt = DateTime.UtcNow,
        });
        db.Complaints.Add(new Complaint
        {
            ResidentId = residentId,
            PickupRequestId = pickupId,
            Description = new string('c', 2001),
            Status = ComplaintStatus.Open,
            CreatedAt = DateTime.UtcNow,
        });

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        var pg = Assert.IsType<PostgresException>(ex.InnerException);
        Assert.Equal("22001", pg.SqlState);
    }

    [SkippableFact]
    public async Task Approval_request_persists_with_pickup_foreign_key()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        var residentId = await _pg.AddProfileAsync();
        var pickupId = Guid.NewGuid();
        var approvalId = Guid.NewGuid();

        await using (var db = _pg.NewContext())
        {
            db.PickupRequests.Add(new PickupRequest
            {
                Id = pickupId,
                ResidentId = residentId,
                Description = "mixed",
                PreferredDate = DateTime.UtcNow.AddDays(2),
                Status = PickupStatus.Classified,
                CreatedAt = DateTime.UtcNow,
            });
            db.ApprovalRequests.Add(new ApprovalRequest
            {
                Id = approvalId,
                PickupRequestId = pickupId,
                FlagReason = "Review required",
                Status = ApprovalStatus.Pending,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        await using (var db = _pg.NewContext())
        {
            var approval = await db.ApprovalRequests.Include(a => a.PickupRequest)
                .SingleAsync(a => a.Id == approvalId);
            Assert.NotNull(approval.PickupRequest);
            Assert.Equal(pickupId, approval.PickupRequestId);
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
