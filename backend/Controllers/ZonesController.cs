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
