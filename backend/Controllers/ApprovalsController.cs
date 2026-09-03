using System.Security.Claims;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/approvals")]
[Authorize(Roles = "admin")]
public class ApprovalsController : ControllerBase
{
    private readonly IApprovalService _service;

    public ApprovalsController(IApprovalService service) => _service = service;

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

    // POST /api/approvals/{id}/approve — admin approves a flagged request
    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveApprovalDto? dto)
    {
        try
        {
            var result = await _service.ApproveAsync(id, CurrentUserId, dto ?? new ApproveApprovalDto());
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    // POST /api/approvals/{id}/reject — admin rejects with a reason
    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectApprovalDto dto)
    {
        try
        {
            var result = await _service.RejectAsync(id, CurrentUserId, dto);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
