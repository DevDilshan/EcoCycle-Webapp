using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.DTOs;
using backend.Services;

namespace backend.Controllers;

[ApiController]
[Route("api/zones")]
[Authorize]
public class ZonesController : ControllerBase
{
    private readonly ZoneService _zoneService;

    public ZonesController(ZoneService zoneService)
    {
        _zoneService = zoneService;
    }

    // GET /api/zones/public - the landing page's "Where we collect" map.
    // Anonymous on purpose, and returns PublicZoneDto rather than ZoneDto so no
    // collector ids or activity flags leave the building.
    [HttpGet("public")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(List<PublicZoneDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<PublicZoneDto>>> GetPublic()
    {
        var zones = await _zoneService.GetPublicZonesAsync();
        return Ok(zones);
    }

    // GET /api/zones/selectable - id + name of active zones, for the resident's
    // pickup form. Any signed-in user, not just admins: a resident has to choose
    // their zone, and /zones itself leaks collector ids and activity flags.
    [HttpGet("selectable")]
    [Authorize]
    [ProducesResponseType(typeof(List<ZoneOptionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ZoneOptionDto>>> GetSelectable()
    {
        var zones = await _zoneService.GetSelectableZonesAsync();
        return Ok(zones);
    }

    [HttpPost]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(ZoneDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<ZoneDto>> Create([FromBody] CreateZoneDto dto)
    {
        var zone = await _zoneService.CreateZoneAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = zone.Id }, zone);
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<ZoneDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ZoneDto>>> GetAll()
    {
        var zones = await _zoneService.GetAllZonesAsync();
        return Ok(zones);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ZoneDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ZoneDto>> GetById(Guid id)
    {
        var zone = await _zoneService.GetZoneByIdAsync(id);
        return zone is null ? NotFound() : Ok(zone);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(ZoneDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ZoneDto>> Update(Guid id, [FromBody] CreateZoneDto dto)
    {
        var zone = await _zoneService.UpdateZoneAsync(id, dto);
        return zone is null ? NotFound() : Ok(zone);
    }

    // Deactivates the zone rather than removing the row: pickups and route
    // assignments reference it, and their history has to stay readable. See
    // ZoneService.DeleteZoneAsync.
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _zoneService.DeleteZoneAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
