using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

// The points ledger outside of automatic awards: reading one entry, an admin
// correcting or removing an entry, the history filters and the leaderboard's
// edges. Runs the real service against an in-memory database.
public class RewardPointEntryTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private readonly Guid _resident = Guid.NewGuid();
    private readonly Guid _other = Guid.NewGuid();
    private readonly Guid _admin = Guid.NewGuid();

    private RewardService Rewards => new(_db);

    public RewardPointEntryTests()
    {
        _db.Profiles.AddRange(
            new Profile { Id = _resident, Email = "res@test.com", FullName = "Resi", Role = "resident" },
            new Profile { Id = _other, Email = "other@test.com", FullName = "Other", Role = "resident" });
        _db.SaveChanges();
    }

    private RewardPoint AddEntry(int points, DateTime? createdAt = null, Guid? residentId = null, string reason = "seed")
    {
        var entry = new RewardPoint
        {
            ResidentId = residentId ?? _resident,
            PointsEarned = points,
            Reason = reason,
            CreatedAt = createdAt ?? DateTime.UtcNow
        };
        _db.RewardPoints.Add(entry);
        _db.SaveChanges();
        return entry;
    }

    private static RewardHistoryQueryParams Query(DateTime? from = null, DateTime? to = null, string sortDir = "desc", int page = 1, int pageSize = 10) =>
        new() { FromDate = from, ToDate = to, SortDir = sortDir, Page = page, PageSize = pageSize };

    // ---- one entry -----------------------------------------------------

    [Fact]
    public async Task A_resident_can_read_their_own_entry()
    {
        var entry = AddEntry(5);
        var dto = await Rewards.GetByIdAsync(entry.Id, _resident, isAdmin: false);
        Assert.Equal(5, dto!.PointsEarned);
    }

    [Fact]
    public async Task A_resident_cannot_read_someone_elses_entry_but_an_admin_can()
    {
        var entry = AddEntry(5, residentId: _other);

        Assert.Null(await Rewards.GetByIdAsync(entry.Id, _resident, isAdmin: false));
        Assert.NotNull(await Rewards.GetByIdAsync(entry.Id, _admin, isAdmin: true));
    }

    [Fact]
    public async Task An_unknown_entry_reads_as_null()
    {
        Assert.Null(await Rewards.GetByIdAsync(Guid.NewGuid(), _admin, isAdmin: true));
    }

    // ---- correct -------------------------------------------------------

    [Fact]
    public async Task An_admin_correction_replaces_the_points_and_reason()
    {
        var entry = AddEntry(5);

        var updated = await Rewards.UpdateAsync(entry.Id, new UpdateRewardPointDto { PointsEarned = 8, Reason = "  Was E-waste, not recyclable  " });

        Assert.Equal(8, updated!.PointsEarned);
        Assert.Equal("Was E-waste, not recyclable", updated.Reason);
        Assert.Equal(8, _db.RewardPoints.Single(r => r.Id == entry.Id).PointsEarned);
    }

    [Fact]
    public async Task A_correction_to_zero_points_is_refused()
    {
        var entry = AddEntry(5);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            Rewards.UpdateAsync(entry.Id, new UpdateRewardPointDto { PointsEarned = 0, Reason = "zero" }));
    }

    [Fact]
    public async Task A_correction_needs_a_reason()
    {
        var entry = AddEntry(5);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            Rewards.UpdateAsync(entry.Id, new UpdateRewardPointDto { PointsEarned = 4, Reason = "   " }));
    }

    [Fact]
    public async Task Correcting_an_unknown_entry_returns_null()
    {
        Assert.Null(await Rewards.UpdateAsync(Guid.NewGuid(), new UpdateRewardPointDto { PointsEarned = 4, Reason = "x" }));
    }

    // ---- remove --------------------------------------------------------

    [Fact]
    public async Task Removing_an_entry_takes_it_out_of_the_balance()
    {
        AddEntry(10);
        var wrong = AddEntry(7);

        Assert.True(await Rewards.DeleteAsync(wrong.Id));

        var history = await Rewards.GetHistoryAsync(_resident, _resident, isAdmin: false, Query());
        Assert.Equal(10, history!.CurrentBalance);
    }

    [Fact]
    public async Task Removing_an_unknown_entry_returns_false()
    {
        Assert.False(await Rewards.DeleteAsync(Guid.NewGuid()));
    }

    // ---- history -------------------------------------------------------

    [Fact]
    public async Task A_resident_cannot_read_another_residents_history()
    {
        AddEntry(5, residentId: _other);
        Assert.Null(await Rewards.GetHistoryAsync(_other, _resident, isAdmin: false, Query()));
        Assert.NotNull(await Rewards.GetHistoryAsync(_other, _admin, isAdmin: true, Query()));
    }

    [Fact]
    public async Task History_for_an_unknown_resident_is_null()
    {
        Assert.Null(await Rewards.GetHistoryAsync(Guid.NewGuid(), _admin, isAdmin: true, Query()));
    }

    [Fact]
    public async Task A_date_filter_narrows_the_list_but_not_the_balance()
    {
        AddEntry(5, new DateTime(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc));
        AddEntry(3, new DateTime(2026, 9, 20, 10, 0, 0, DateTimeKind.Utc));

        var history = await Rewards.GetHistoryAsync(_resident, _resident, false,
            Query(from: new DateTime(2026, 9, 10), to: new DateTime(2026, 9, 30)));

        Assert.Equal(8, history!.CurrentBalance);
        Assert.Equal(1, history.TotalCount);
        Assert.Equal(3, history.Items.Single().PointsEarned);
    }

    [Fact]
    public async Task A_date_only_end_includes_the_whole_day()
    {
        AddEntry(4, new DateTime(2026, 9, 20, 23, 30, 0, DateTimeKind.Utc));

        var history = await Rewards.GetHistoryAsync(_resident, _resident, false,
            Query(to: new DateTime(2026, 9, 20)));

        Assert.Equal(1, history!.TotalCount);
    }

    [Fact]
    public async Task A_start_after_the_end_is_refused()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            Rewards.GetHistoryAsync(_resident, _resident, false,
                Query(from: new DateTime(2026, 9, 30), to: new DateTime(2026, 9, 1))));
    }

    [Fact]
    public async Task History_is_paged_and_can_be_sorted_oldest_first()
    {
        for (var day = 1; day <= 5; day++)
            AddEntry(day, new DateTime(2026, 9, day, 12, 0, 0, DateTimeKind.Utc));

        var page2 = await Rewards.GetHistoryAsync(_resident, _resident, false, Query(sortDir: "asc", page: 2, pageSize: 2));

        Assert.Equal(5, page2!.TotalCount);
        Assert.Equal(new[] { 3, 4 }, page2.Items.Select(i => i.PointsEarned));
    }

    // ---- leaderboard ---------------------------------------------------

    [Fact]
    public async Task The_leaderboard_counts_only_this_months_points()
    {
        var lastMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddDays(-1);
        AddEntry(50, lastMonth, _other);
        AddEntry(5, residentId: _resident);

        var board = await Rewards.GetLeaderboardAsync(10);

        Assert.Equal("Resi", board.Single().ResidentName);
    }

    [Fact]
    public async Task The_leaderboard_respects_the_limit_and_numbers_the_ranks()
    {
        AddEntry(9, residentId: _resident);
        AddEntry(4, residentId: _other);

        var board = await Rewards.GetLeaderboardAsync(1);

        Assert.Single(board);
        Assert.Equal(1, board[0].Rank);
        Assert.Equal(9, board[0].PointsEarned);
    }

    [Fact]
    public async Task A_resident_without_a_profile_is_shown_as_unknown()
    {
        AddEntry(6, residentId: Guid.NewGuid());
        var board = await Rewards.GetLeaderboardAsync(10);
        Assert.Equal("Unknown resident", board.Single().ResidentName);
    }
}
