using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/reward-items")]
[Authorize]
public class RewardItemsController : ControllerBase
{
    private readonly IRewardItemService _service;

    public RewardItemsController(IRewardItemService service) => _service = service;

    private bool IsAdmin => User.IsInRole("admin");

    // GET /api/reward-items - the catalog (residents see active items only).
    [HttpGet]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetList([FromQuery] RewardItemQueryParams query) =>
        Ok(await _service.GetListAsync(IsAdmin, query));

    // GET /api/reward-items/{id}
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var item = await _service.GetByIdAsync(id, IsAdmin);
        return item is null ? NotFound() : Ok(item);
    }

    // POST /api/reward-items - admin adds a catalog item.
    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] SaveRewardItemDto dto)
    {
        try
        {
            var created = await _service.CreateAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // PUT /api/reward-items/{id} - admin edits name, cost, stock or availability.
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] SaveRewardItemDto dto)
    {
        try
        {
            var updated = await _service.UpdateAsync(id, dto);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // DELETE /api/reward-items/{id} - admin removes an item with no pending requests.
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            return await _service.DeleteAsync(id) ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }
}
