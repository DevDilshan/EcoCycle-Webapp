using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.DTOs;
using backend.Services;

namespace backend.Controllers;

// What each collector's round can take: stops per day, and which restricted
// categories their vehicle is equipped for. Admin-only -- this is operational
// capacity planning, not something a collector sets for themselves.
[ApiController]
[Route("api/collector-settings")]
[Authorize(Roles = "admin")]
public class CollectorSettingsController : ControllerBase
{
    private readonly CollectorSettingService _service;

    public CollectorSettingsController(CollectorSettingService service) => _service = service;

    [HttpGet]
    [ProducesResponseType(typeof(List<CollectorSettingDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CollectorSettingDto>>> GetAll()
        => Ok(await _service.GetAllAsync());

    [HttpPut("{collectorId:guid}")]
    [ProducesResponseType(typeof(CollectorSettingDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CollectorSettingDto>> Update(
        Guid collectorId,
        [FromBody] UpdateCollectorSettingDto dto)
    {
        var updated = await _service.UpdateAsync(collectorId, dto);
        return updated is null ? NotFound() : Ok(updated);
    }
}
