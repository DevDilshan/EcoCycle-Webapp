using System.Security.Claims;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/pickuprequests")]
[Authorize] // must be logged in for every endpoint; per-endpoint roles below
public class PickupRequestsController : ControllerBase
{
    private readonly IPickupRequestService _service;

    public PickupRequestsController(IPickupRequestService service) => _service = service;

   // "sub" gets remapped to NameIdentifier by default; check both to be safe
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

    // POST /api/pickuprequests  — resident creates a request
    [HttpPost]
    [Authorize(Roles = "resident")]
    public async Task<IActionResult> Create([FromBody] CreatePickupRequestDto dto)
    {
        if (dto.PreferredDate.Date < DateTime.UtcNow.Date)
            return BadRequest(new { message = "PreferredDate cannot be in the past." });

        var created = await _service.CreateAsync(CurrentUserId, dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    // GET /api/pickuprequests  — admin sees all, resident sees own (filter/sort/paging)
    [HttpGet]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetList([FromQuery] PickupRequestQueryParams query)
    {
        var result = await _service.GetListAsync(CurrentUserId, IsAdmin, query);
        return Ok(result);
    }

    // GET /api/pickuprequests/{id}  — full detail
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var dto = await _service.GetByIdAsync(id, CurrentUserId, IsAdmin);
        return dto is null ? NotFound() : Ok(dto);
    }

    // GET /api/pickuprequests/{id}/status  — real-time status
    [HttpGet("{id:guid}/status")]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetStatus(Guid id)
    {
        var dto = await _service.GetStatusAsync(id, CurrentUserId, IsAdmin);
        return dto is null ? NotFound() : Ok(dto);
    }

    // PUT /api/pickuprequests/{id}  — edit a pending request
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "resident")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePickupRequestDto dto)
    {
        try
        {
            var updated = await _service.UpdateAsync(id, CurrentUserId, IsAdmin, dto);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message }); // 409: not pending
        }
    }

    // DELETE /api/pickuprequests/{id}  — cancel a pending request
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "resident")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id, CurrentUserId, IsAdmin);
        return result switch
        {
            PickupOperationResult.Success     => NoContent(),
            PickupOperationResult.NotFound    => NotFound(),
            PickupOperationResult.Forbidden   => Forbid(),
            PickupOperationResult.NotEditable => Conflict(new { message = "Only pending requests can be cancelled." }),
            _ => StatusCode(500)
        };
    }
}