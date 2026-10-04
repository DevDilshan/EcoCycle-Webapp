using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

public class RedemptionServiceTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private readonly Guid _resident = Guid.NewGuid();
    private readonly Guid _admin = Guid.NewGuid();

    private RedemptionService Service => new(_db);

    public RedemptionServiceTests()
    {
        _db.Profiles.AddRange(
            new Profile { Id = _resident, Email = "res@test.com", FullName = "Resi", Role = "resident" },
            new Profile { Id = _admin, Email = "admin@test.com", FullName = "Adm", Role = "admin" });
        _db.SaveChanges();
    }

    private void GivePoints(int points, Guid? residentId = null)
    {
        _db.RewardPoints.Add(new RewardPoint
        {
            ResidentId = residentId ?? _resident,
            PointsEarned = points,
            Reason = "seed"
        });
        _db.SaveChanges();
    }

    private RewardItem AddItem(int cost, string name = "Grocery voucher", int? stock = null, bool active = true)
    {
        var item = new RewardItem { Name = name, PointsCost = cost, Stock = stock, IsActive = active };
        _db.RewardItems.Add(item);
        _db.SaveChanges();
        return item;
    }

    // A request for a fresh catalog item that costs `points`.
    private CreateRedemptionDto Create(int points, string name = "Grocery voucher") =>
        new() { RewardItemId = AddItem(points, name).Id };

    private UpdateRedemptionDto Switch(int points) =>
        new() { RewardItemId = AddItem(points, "Other item").Id };

    private int Balance(Guid? residentId = null) =>
        _db.RewardPoints.Where(r => r.ResidentId == (residentId ?? _resident)).Sum(r => r.PointsEarned);

    // ---- create -------------------------------------------------------

    [Fact]
    public async Task Create_saves_a_pending_request_without_touching_the_balance()
    {
        GivePoints(100);

        var created = await Service.CreateAsync(_resident, Create(40));

        Assert.Equal(RedemptionStatus.Pending, created.Status);
        Assert.Equal(40, created.Points);
        Assert.Equal("Resi", created.ResidentName);
        Assert.Equal(100, Balance());
    }

    [Fact]
    public async Task Create_more_than_the_balance_is_refused()
    {
        GivePoints(30);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.CreateAsync(_resident, Create(31)));
    }

    [Fact]
    public async Task Pending_requests_count_against_what_can_be_requested()
    {
        GivePoints(100);
        await Service.CreateAsync(_resident, Create(60));

        // 100 balance - 60 already requested leaves 40.
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.CreateAsync(_resident, Create(41)));
        await Service.CreateAsync(_resident, Create(40));
    }

    [Fact]
    public async Task Create_copies_the_items_name_and_cost_into_the_request()
    {
        GivePoints(200);
        var item = AddItem(120, "Transit credit");

        var created = await Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = item.Id });

        Assert.Equal(120, created.Points);
        Assert.Equal("Transit credit", created.Reason);
        Assert.Equal(item.Id, created.RewardItemId);
    }

    [Fact]
    public async Task Create_for_an_unknown_item_is_not_found()
    {
        GivePoints(10);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = Guid.NewGuid() }));
    }

    [Fact]
    public async Task Create_for_an_inactive_or_sold_out_item_is_refused()
    {
        GivePoints(100);
        var inactive = AddItem(10, "Hidden", active: false);
        var soldOut = AddItem(10, "Gone", stock: 0);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = inactive.Id }));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = soldOut.Id }));
    }

    // ---- read ---------------------------------------------------------

    [Fact]
    public async Task Resident_only_lists_their_own_requests_but_admin_sees_all()
    {
        var other = Guid.NewGuid();
        _db.Profiles.Add(new Profile { Id = other, Email = "o@test.com", Role = "resident" });
        _db.SaveChanges();
        GivePoints(50);
        GivePoints(50, other);
        await Service.CreateAsync(_resident, Create(10));
        await Service.CreateAsync(other, Create(10));

        var mine = await Service.GetListAsync(_resident, isAdmin: false, new RedemptionQueryParams());
        var all = await Service.GetListAsync(_admin, isAdmin: true, new RedemptionQueryParams());

        Assert.Equal(1, mine.TotalCount);
        Assert.Equal(2, all.TotalCount);
    }

    [Fact]
    public async Task List_filters_by_status_and_searches_name_and_reason()
    {
        GivePoints(100);
        var a = await Service.CreateAsync(_resident, Create(10, "Tree planting donation"));
        await Service.CreateAsync(_resident, Create(10, "Grocery voucher"));
        await Service.RejectAsync(a.Id, _admin, new ReviewRedemptionDto { AdminNote = "no" });

        var rejected = await Service.GetListAsync(_admin, true, new RedemptionQueryParams { Status = RedemptionStatus.Rejected });
        var byReason = await Service.GetListAsync(_admin, true, new RedemptionQueryParams { Search = "grocery" });
        var byName = await Service.GetListAsync(_admin, true, new RedemptionQueryParams { Search = "resi" });

        Assert.Equal(1, rejected.TotalCount);
        Assert.Equal(1, byReason.TotalCount);
        Assert.Equal(2, byName.TotalCount);
    }

    [Fact]
    public async Task List_sorts_by_points_and_pages()
    {
        GivePoints(100);
        await Service.CreateAsync(_resident, Create(5));
        await Service.CreateAsync(_resident, Create(30));
        await Service.CreateAsync(_resident, Create(10));

        var page = await Service.GetListAsync(_admin, true,
            new RedemptionQueryParams { SortBy = "points", SortDir = "desc", PageSize = 2 });

        Assert.Equal(new[] { 30, 10 }, page.Items.Select(i => i.Points));
        Assert.Equal(3, page.TotalCount);
        Assert.Equal(2, page.TotalPages);
    }

    [Fact]
    public async Task Another_residents_request_cannot_be_read()
    {
        GivePoints(50);
        var created = await Service.CreateAsync(_resident, Create(10));

        Assert.Null(await Service.GetByIdAsync(created.Id, Guid.NewGuid(), isAdmin: false));
        Assert.NotNull(await Service.GetByIdAsync(created.Id, _admin, isAdmin: true));
    }

    // ---- update / delete ----------------------------------------------

    [Fact]
    public async Task Pending_request_can_be_edited_and_can_keep_its_own_points_reserved()
    {
        GivePoints(100);
        var created = await Service.CreateAsync(_resident, Create(100));

        // Switching to another 100-point item must not count the request against itself.
        var updated = await Service.UpdateAsync(created.Id, _resident, Switch(100));

        Assert.Equal("Other item", updated!.Reason);
    }

    [Fact]
    public async Task Editing_to_more_than_available_is_refused()
    {
        GivePoints(50);
        var created = await Service.CreateAsync(_resident, Create(10));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.UpdateAsync(created.Id, _resident, Switch(51)));
    }

    [Fact]
    public async Task Another_resident_cannot_edit_or_cancel_the_request()
    {
        GivePoints(50);
        var created = await Service.CreateAsync(_resident, Create(10));
        var stranger = Guid.NewGuid();

        Assert.Null(await Service.UpdateAsync(created.Id, stranger, Switch(5)));
        Assert.False(await Service.DeleteAsync(created.Id, stranger));
    }

    [Fact]
    public async Task Pending_request_can_be_cancelled()
    {
        GivePoints(50);
        var created = await Service.CreateAsync(_resident, Create(10));

        Assert.True(await Service.DeleteAsync(created.Id, _resident));
        Assert.Equal(0, await _db.RedemptionRequests.CountAsync());
    }

    [Fact]
    public async Task Decided_request_can_no_longer_be_edited_or_cancelled()
    {
        GivePoints(50);
        var created = await Service.CreateAsync(_resident, Create(10));
        await Service.RejectAsync(created.Id, _admin, new ReviewRedemptionDto { AdminNote = "no" });

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.UpdateAsync(created.Id, _resident, Switch(5)));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.DeleteAsync(created.Id, _resident));
    }

    // ---- approve / reject ---------------------------------------------

    [Fact]
    public async Task Approve_writes_a_negative_ledger_row_and_records_the_reviewer()
    {
        GivePoints(100);
        var created = await Service.CreateAsync(_resident, Create(40));

        var approved = await Service.ApproveAsync(created.Id, _admin, new ReviewRedemptionDto { AdminNote = "Enjoy" });

        Assert.Equal(RedemptionStatus.Approved, approved!.Status);
        Assert.Equal("Enjoy", approved.AdminNote);
        Assert.Equal(60, Balance());
        var stored = await _db.RedemptionRequests.SingleAsync();
        Assert.Equal(_admin, stored.ReviewedByAdminId);
        Assert.NotNull(stored.ReviewedAt);
    }

    [Fact]
    public async Task Approve_is_refused_when_the_balance_has_dropped_since_the_request()
    {
        GivePoints(50);
        var created = await Service.CreateAsync(_resident, Create(40));
        GivePoints(-30); // an admin correction after the request

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.ApproveAsync(created.Id, _admin, new ReviewRedemptionDto()));
        Assert.Equal(20, Balance());
    }

    [Fact]
    public async Task Approve_takes_one_from_the_items_stock()
    {
        GivePoints(100);
        var item = AddItem(40, "Voucher", stock: 2);
        var created = await Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = item.Id });

        await Service.ApproveAsync(created.Id, _admin, new ReviewRedemptionDto());

        Assert.Equal(1, (await _db.RewardItems.FindAsync(item.Id))!.Stock);
    }

    [Fact]
    public async Task Approve_is_refused_when_the_item_sold_out_meanwhile()
    {
        GivePoints(100);
        var item = AddItem(40, "Voucher", stock: 1);
        var first = await Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = item.Id });
        var second = await Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = item.Id });
        await Service.ApproveAsync(first.Id, _admin, new ReviewRedemptionDto());

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.ApproveAsync(second.Id, _admin, new ReviewRedemptionDto()));
        Assert.Equal(60, Balance());
    }

    [Fact]
    public async Task Unlimited_items_keep_a_null_stock_after_approval()
    {
        GivePoints(100);
        var item = AddItem(40, "Donation");
        var created = await Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = item.Id });

        await Service.ApproveAsync(created.Id, _admin, new ReviewRedemptionDto());

        Assert.Null((await _db.RewardItems.FindAsync(item.Id))!.Stock);
    }

    [Fact]
    public async Task A_request_cannot_be_approved_twice()
    {
        GivePoints(100);
        var created = await Service.CreateAsync(_resident, Create(40));
        await Service.ApproveAsync(created.Id, _admin, new ReviewRedemptionDto());

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.ApproveAsync(created.Id, _admin, new ReviewRedemptionDto()));
        Assert.Equal(60, Balance());
    }

    [Fact]
    public async Task Reject_requires_a_note_and_leaves_the_balance_alone()
    {
        GivePoints(100);
        var created = await Service.CreateAsync(_resident, Create(40));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service.RejectAsync(created.Id, _admin, new ReviewRedemptionDto()));

        var rejected = await Service.RejectAsync(created.Id, _admin, new ReviewRedemptionDto { AdminNote = "Out of stock" });

        Assert.Equal(RedemptionStatus.Rejected, rejected!.Status);
        Assert.Equal(100, Balance());
    }

    [Fact]
    public async Task Unknown_request_returns_null_for_review()
    {
        Assert.Null(await Service.ApproveAsync(Guid.NewGuid(), _admin, new ReviewRedemptionDto()));
        Assert.Null(await Service.RejectAsync(Guid.NewGuid(), _admin, new ReviewRedemptionDto { AdminNote = "x" }));
    }
}
