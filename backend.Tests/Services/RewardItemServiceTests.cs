using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

public class RewardItemServiceTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private RewardItemService Service => new(_db);

    private static SaveRewardItemDto Dto(string name = "Voucher", int cost = 100, int? stock = null, bool active = true) =>
        new() { Name = name, PointsCost = cost, Stock = stock, IsActive = active };

    [Fact]
    public async Task Image_selection_round_trips_and_can_return_to_name_matching()
    {
        var dto = Dto("Reusable tote bag", 5, 17);
        dto.ImageUrl = "  https://example.com/tote.webp  ";
        var created = await Service.CreateAsync(dto);
        Assert.Equal("https://example.com/tote.webp", created.ImageUrl);
        Assert.Equal(created.ImageUrl, (await Service.GetByIdAsync(created.Id, false))!.ImageUrl);
        dto.ImageUrl = "/images/rewards/tote.webp";
        Assert.Equal(dto.ImageUrl, (await Service.UpdateAsync(created.Id, dto))!.ImageUrl);
        dto.ImageUrl = null;
        var automatic = await Service.UpdateAsync(created.Id, dto);
        Assert.Equal("/images/rewards/tote.webp", automatic!.ImageUrl);
        Assert.Null((await _db.RewardItems.FindAsync(created.Id))!.ImageUrl);
        Assert.Equal(17, automatic.Stock);
        Assert.Equal(5, automatic.PointsCost);
        dto.ImageUrl = "";
        Assert.Equal("", (await Service.UpdateAsync(created.Id, dto))!.ImageUrl);
        Assert.Equal("", (await Service.GetByIdAsync(created.Id, false))!.ImageUrl);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("data:image/svg+xml;base64,abc")]
    [InlineData("http://example.com/a.webp")]
    [InlineData("https://user:password@example.com/a.webp")]
    [InlineData("/images/rewards/../../other.webp")]
    public async Task Unsafe_image_references_are_rejected_without_creating_an_item(string image)
    {
        var dto = Dto();
        dto.ImageUrl = image;
        await Assert.ThrowsAsync<ArgumentException>(() => Service.CreateAsync(dto));
        Assert.Empty(await _db.RewardItems.ToListAsync());
    }

    [Fact]
    public async Task Legacy_catalog_gets_artwork_without_changing_saved_records()
    {
        var legacy = new RewardItem { Name = "Home compost bin (220 L)", PointsCost = 250, Stock = 15 };
        _db.RewardItems.Add(legacy);
        await _db.SaveChangesAsync();
        var listed = await Service.GetListAsync(false, new RewardItemQueryParams());
        Assert.Equal("/images/rewards/compost-bin.webp", listed.Items.Single().ImageUrl);
        Assert.Null((await _db.RewardItems.FindAsync(legacy.Id))!.ImageUrl);
    }

    [Fact]
    public async Task Create_saves_the_trimmed_item()
    {
        var created = await Service.CreateAsync(Dto("  Grocery voucher  ", 100, stock: 5));

        Assert.Equal("Grocery voucher", created.Name);
        Assert.Equal(100, created.PointsCost);
        Assert.Equal(5, created.Stock);
        Assert.True(created.IsActive);
    }

    [Fact]
    public async Task Create_with_a_blank_name_is_rejected() =>
        await Assert.ThrowsAsync<ArgumentException>(() => Service.CreateAsync(Dto("   ")));

    [Fact]
    public async Task Update_changes_the_fields_and_stamps_UpdatedAt()
    {
        var created = await Service.CreateAsync(Dto("Old", 50));

        var updated = await Service.UpdateAsync(created.Id, Dto("New", 75, stock: 3, active: false));

        Assert.Equal("New", updated!.Name);
        Assert.Equal(75, updated.PointsCost);
        Assert.Equal(3, updated.Stock);
        Assert.False(updated.IsActive);
        Assert.True(updated.UpdatedAt >= created.UpdatedAt);
    }

    [Fact]
    public async Task Update_of_an_unknown_item_returns_null() =>
        Assert.Null(await Service.UpdateAsync(Guid.NewGuid(), Dto()));

    [Fact]
    public async Task Residents_only_see_active_items_but_admins_see_all()
    {
        await Service.CreateAsync(Dto("Shown", 10));
        await Service.CreateAsync(Dto("Hidden", 20, active: false));

        var resident = await Service.GetListAsync(isAdmin: false, new RewardItemQueryParams { IsActive = false });
        var admin = await Service.GetListAsync(isAdmin: true, new RewardItemQueryParams());
        var adminInactive = await Service.GetListAsync(isAdmin: true, new RewardItemQueryParams { IsActive = false });

        Assert.Equal(new[] { "Shown" }, resident.Items.Select(i => i.Name));
        Assert.Equal(2, admin.TotalCount);
        Assert.Equal(new[] { "Hidden" }, adminInactive.Items.Select(i => i.Name));
    }

    [Fact]
    public async Task List_searches_sorts_and_pages()
    {
        await Service.CreateAsync(Dto("Tree donation", 300));
        await Service.CreateAsync(Dto("Grocery voucher", 100));
        await Service.CreateAsync(Dto("Transit credit", 200));

        var search = await Service.GetListAsync(true, new RewardItemQueryParams { Search = "TREE" });
        var cheapest = await Service.GetListAsync(true, new RewardItemQueryParams { PageSize = 2 });
        var byNameDesc = await Service.GetListAsync(true, new RewardItemQueryParams { SortBy = "name", SortDir = "desc" });

        Assert.Equal(1, search.TotalCount);
        Assert.Equal(new[] { 100, 200 }, cheapest.Items.Select(i => i.PointsCost));
        Assert.Equal(2, cheapest.TotalPages);
        Assert.Equal("Tree donation", byNameDesc.Items.First().Name);
    }

    [Fact]
    public async Task Residents_cannot_read_an_inactive_item_by_id()
    {
        var hidden = await Service.CreateAsync(Dto("Hidden", 20, active: false));

        Assert.Null(await Service.GetByIdAsync(hidden.Id, isAdmin: false));
        Assert.NotNull(await Service.GetByIdAsync(hidden.Id, isAdmin: true));
    }

    [Fact]
    public async Task Delete_removes_an_unused_item()
    {
        var created = await Service.CreateAsync(Dto());

        Assert.True(await Service.DeleteAsync(created.Id));
        Assert.Equal(0, await _db.RewardItems.CountAsync());
        Assert.False(await Service.DeleteAsync(created.Id));
    }

    [Fact]
    public async Task Delete_is_refused_while_a_request_is_pending_for_the_item()
    {
        var created = await Service.CreateAsync(Dto());
        _db.RedemptionRequests.Add(new RedemptionRequest
        {
            ResidentId = Guid.NewGuid(),
            RewardItemId = created.Id,
            Points = 100,
            Reason = "Voucher",
            Status = RedemptionStatus.Pending
        });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.DeleteAsync(created.Id));
        Assert.Equal(1, await _db.RewardItems.CountAsync());
    }

    [Fact]
    public async Task Delete_is_allowed_once_requests_are_decided()
    {
        var created = await Service.CreateAsync(Dto());
        _db.RedemptionRequests.Add(new RedemptionRequest
        {
            ResidentId = Guid.NewGuid(),
            RewardItemId = created.Id,
            Points = 100,
            Reason = "Voucher",
            Status = RedemptionStatus.Rejected
        });
        await _db.SaveChangesAsync();

        Assert.True(await Service.DeleteAsync(created.Id));
    }
}
