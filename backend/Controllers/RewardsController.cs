using System.Security.Claims;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/rewards")]
[Authorize]
public class RewardsController : ControllerBase
{
    private readonly IRewardService _service;

    public RewardsController(IRewardService service) => _service = service;

    private Guid CurrentUserId
    {
        get
        {
            var subject = User.FindFirstValue(ClaimTypes.NameIdentifier)
                          ?? User.FindFirstValue("sub");
            return Guid.TryParse(subject, out var id)
                ? id
                : throw new UnauthorizedAccessException("Missing or invalid sub claim.");
        }
    }

    private bool IsAdmin => User.IsInRole("admin");

    // POST /api/rewards - admin awards points for a resident's pickup.
    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Award([FromBody] AwardRewardPointsDto dto)
    {
        try
        {
            var created = await _service.AwardAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // GET /api/rewards/{residentId}/history - admin sees any resident; residents see their own.
    [HttpGet("{residentId:guid}/history")]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetHistory(
        Guid residentId,
        [FromQuery] RewardHistoryQueryParams query)
    {
        try
        {
            var history = await _service.GetHistoryAsync(
                residentId,
                CurrentUserId,
                IsAdmin,
                query);

            return history is null ? NotFound() : Ok(history);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // GET /api/rewards/leaderboard - top point earners for the current UTC month.
    [HttpGet("leaderboard")]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetLeaderboard([FromQuery] int limit = 10) =>
        Ok(await _service.GetLeaderboardAsync(limit));

    // GET /api/rewards/{id} - view one points transaction.
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "admin,resident")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var reward = await _service.GetByIdAsync(id, CurrentUserId, IsAdmin);
        return reward is null ? NotFound() : Ok(reward);
    }

    // PUT /api/rewards/{id} - admin corrects a points transaction.
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRewardPointDto dto)
    {
        try
        {
            var updated = await _service.UpdateAsync(id, dto);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // DELETE /api/rewards/{id} - admin removes an incorrect points transaction.
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(Guid id) =>
        await _service.DeleteAsync(id) ? NoContent() : NotFound();

    // POST /api/rewards/redeem - resident spends points, recorded as a negative transaction.
    [HttpPost("redeem")]
    [Authorize(Roles = "resident")]
    public async Task<IActionResult> Redeem([FromBody] RedeemRewardPointsDto dto)
    {
        try
        {
            return Ok(await _service.RedeemAsync(CurrentUserId, dto));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
