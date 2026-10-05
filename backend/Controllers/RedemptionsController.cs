using System.Security.Claims;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/redemptions")]
[Authorize]
public class RedemptionsController : ControllerBase
{
    private readonly IRedemptionService _service;

    public RedemptionsController(IRedemptionService service) => _service = service;

    private Guid CurrentUserId
    {
        get
        {
            var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? User.FindFirstValue("sub");
            return Guid.TryParse(sub, out var id)
                ? id
                : throw new UnauthorizedAccessException("Missing or invalid sub claim.");
        }
    }

    private bool IsAdmin => User.IsInRole("admin");

    // POST /api/redemptions - resident asks to spend points.
    [HttpPost]
    [Authorize(Roles = "resident")]
    public async Task<IActionResult> Create([FromBody] CreateRedemptionDto dto)
    {
        try
        {
            var created = await _service.CreateAsync(CurrentUserId, dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    // GET /api/redemptions - admin sees all (status filter, search, sort, paging); residents see their own.
    [HttpGet]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetList([FromQuery] RedemptionQueryParams query) =>
        Ok(await _service.GetListAsync(CurrentUserId, IsAdmin, query));

    // GET /api/redemptions/{id}
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var item = await _service.GetByIdAsync(id, CurrentUserId, IsAdmin);
        return item is null ? NotFound() : Ok(item);
    }

    // PUT /api/redemptions/{id} - resident edits their own request while it is Pending.
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "resident")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRedemptionDto dto)
    {
        try
        {
            var updated = await _service.UpdateAsync(id, CurrentUserId, dto);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    // DELETE /api/redemptions/{id} - resident cancels their own request while it is Pending.
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "resident")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            return await _service.DeleteAsync(id, CurrentUserId) ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    // POST /api/redemptions/{id}/approve - admin approves; the points leave the ledger.
    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ReviewRedemptionDto dto)
    {
        try
        {
            var result = await _service.ApproveAsync(id, CurrentUserId, dto);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    // POST /api/redemptions/{id}/reject - admin rejects; a note is required.
    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewRedemptionDto dto)
    {
        try
        {
            var result = await _service.RejectAsync(id, CurrentUserId, dto);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    // POST /api/redemptions/{id}/fulfil - admin records that the item was handed over, emailed or posted.
    [HttpPost("{id:guid}/fulfil")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Fulfil(Guid id)
    {
        try
        {
            var result = await _service.FulfilAsync(id);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }
}
