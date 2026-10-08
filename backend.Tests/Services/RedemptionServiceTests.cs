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
        Assert.Null(await Service.FulfilAsync(Guid.NewGuid()));
    }

    // ---- delivery -----------------------------------------------------

    private RewardItem AddDelivered(RewardDelivery delivery, int cost = 10)
    {
        var item = AddItem(cost, delivery.ToString());
        item.Delivery = delivery;
        _db.SaveChanges();
        return item;
    }

    [Fact]
    public async Task A_posted_item_needs_an_address_and_keeps_it()
    {
        GivePoints(100);
        var item = AddDelivered(RewardDelivery.Post);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = item.Id }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = item.Id, DeliveryAddress = "No 5" }));

        var created = await Service.CreateAsync(_resident,
            new CreateRedemptionDto { RewardItemId = item.Id, DeliveryAddress = "  12 Galle Road, Colombo 03  " });
        var approved = await Service.ApproveAsync(created.Id, _admin, new ReviewRedemptionDto());

        Assert.Equal(RewardDelivery.Post, approved!.Delivery);
        Assert.Equal("12 Galle Road, Colombo 03", approved.DeliveryAddress);
        Assert.Equal(RedemptionService.DefaultDeliveryInstructions(RewardDelivery.Post), approved.DeliveryInstructions);
    }

    [Fact]
    public async Task An_emailed_item_ignores_any_address_and_names_the_account_email()
    {
        GivePoints(100);
        var item = AddDelivered(RewardDelivery.Email);

        var created = await Service.CreateAsync(_resident,
            new CreateRedemptionDto { RewardItemId = item.Id, DeliveryAddress = "12 Galle Road, Colombo 03" });
        var approved = await Service.ApproveAsync(created.Id, _admin, new ReviewRedemptionDto());

        Assert.Null(approved!.DeliveryAddress);
        Assert.Equal("res@test.com", approved.ResidentEmail);
        Assert.Equal(RedemptionService.DefaultDeliveryInstructions(RewardDelivery.Email), approved.DeliveryInstructions);
    }

    [Fact]
    public async Task Switching_item_follows_the_new_items_delivery()
    {
        GivePoints(100);
        var posted = AddDelivered(RewardDelivery.Post);
        var created = await Service.CreateAsync(_resident, Create(10, "Collect me"));

        // No address on file yet, so a posted item cannot be chosen without one.
        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service.UpdateAsync(created.Id, _resident, new UpdateRedemptionDto { RewardItemId = posted.Id }));

        var switched = await Service.UpdateAsync(created.Id, _resident,
            new UpdateRedemptionDto { RewardItemId = posted.Id, DeliveryAddress = "12 Galle Road, Colombo 03" });
        Assert.Equal(RewardDelivery.Post, switched!.Delivery);

        var back = await Service.UpdateAsync(created.Id, _resident, Switch(10));
        Assert.Equal(RewardDelivery.Collect, back!.Delivery);
        Assert.Null(back.DeliveryAddress);
    }

    // ---- collection ---------------------------------------------------

    [Fact]
    public async Task Approve_issues_a_code_and_the_items_collection_instructions()
    {
        GivePoints(100);
        var item = AddItem(40);
        item.DeliveryInstructions = "  Counter 3, Town Hall, weekdays 9 to 4.  ";
        _db.SaveChanges();
        var created = await Service.CreateAsync(_resident, new CreateRedemptionDto { RewardItemId = item.Id });

        Assert.Null(created.CollectionCode);
        Assert.Null(created.DeliveryInstructions);

        var approved = await Service.ApproveAsync(created.Id, _admin, new ReviewRedemptionDto());

        Assert.Matches("^ECO-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$", approved!.CollectionCode);
        Assert.Equal("Counter 3, Town Hall, weekdays 9 to 4.", approved.DeliveryInstructions);
        Assert.Null(approved.FulfilledAt);
    }

    [Fact]
    public async Task Approve_falls_back_to_default_instructions_and_codes_differ()
    {
        GivePoints(100);
        var first = await Service.CreateAsync(_resident, Create(10, "A"));
        var second = await Service.CreateAsync(_resident, Create(10, "B"));

        var a = await Service.ApproveAsync(first.Id, _admin, new ReviewRedemptionDto());
        var b = await Service.ApproveAsync(second.Id, _admin, new ReviewRedemptionDto());

        Assert.Equal(RedemptionService.DefaultDeliveryInstructions(RewardDelivery.Collect), a!.DeliveryInstructions);
        Assert.NotEqual(a.CollectionCode, b!.CollectionCode);
    }

    [Fact]
    public async Task A_rejected_request_gets_no_code()
    {
        GivePoints(100);
        var created = await Service.CreateAsync(_resident, Create(40));

        var rejected = await Service.RejectAsync(created.Id, _admin, new ReviewRedemptionDto { AdminNote = "No" });

        Assert.Null(rejected!.CollectionCode);
        Assert.Null(rejected.DeliveryInstructions);
    }

    [Fact]
    public async Task Collect_works_once_and_only_on_an_approved_request()
    {
        GivePoints(100);
        var pending = await Service.CreateAsync(_resident, Create(10, "A"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.FulfilAsync(pending.Id));

        await Service.ApproveAsync(pending.Id, _admin, new ReviewRedemptionDto());
        var collected = await Service.FulfilAsync(pending.Id);

        Assert.NotNull(collected!.FulfilledAt);
        Assert.Equal(RedemptionStatus.Approved, collected.Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.FulfilAsync(pending.Id));
        Assert.Equal(90, Balance());
    }

    [Fact]
    public async Task Admin_can_find_a_request_by_its_code()
    {
        GivePoints(100);
        var first = await Service.CreateAsync(_resident, Create(10, "A"));
        var second = await Service.CreateAsync(_resident, Create(10, "B"));
        var approved = await Service.ApproveAsync(first.Id, _admin, new ReviewRedemptionDto());
        await Service.ApproveAsync(second.Id, _admin, new ReviewRedemptionDto());

        var found = await Service.GetListAsync(_admin, isAdmin: true,
            new RedemptionQueryParams { Search = approved!.CollectionCode!.ToLower() });

        Assert.Equal(first.Id, Assert.Single(found.Items).Id);
    }
}
