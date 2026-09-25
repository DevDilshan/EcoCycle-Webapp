using System.Security.Claims;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/complaints")]
[Authorize]
public class ComplaintsController : ControllerBase
{
    private readonly IComplaintService _service;

    public ComplaintsController(IComplaintService service) => _service = service;

    private Guid CurrentUserId
    {
        get
        {
            var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? User.FindFirstValue("sub");
            return Guid.TryParse(sub, out var id)
                ? id
                : throw new UnauthorizedAccessException("Missing/invalid sub claim.");
        }
    }

    private bool IsAdmin => User.IsInRole("admin");

    // POST /api/complaints — resident files a complaint
    [HttpPost]
    [Authorize(Roles = "resident")]
    public async Task<IActionResult> Create([FromBody] CreateComplaintDto dto)
    {
        try
        {
            var created = await _service.CreateAsync(CurrentUserId, dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // GET /api/complaints — admin views all, filterable by status
    [HttpGet]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetList([FromQuery] ComplaintQueryParams query) =>
        Ok(await _service.GetListAsync(query));

    // GET /api/complaints/{id} — view one complaint
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var complaint = await _service.GetByIdAsync(id, CurrentUserId, IsAdmin);
        return complaint is null ? NotFound() : Ok(complaint);
    }

    // PUT /api/complaints/{id} — admin updates status/notes
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateComplaintDto dto)
    {
        var updated = await _service.UpdateAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    // DELETE /api/complaints/{id} — remove invalid complaint
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(Guid id) =>
        await _service.DeleteAsync(id) ? NoContent() : NotFound();
}
