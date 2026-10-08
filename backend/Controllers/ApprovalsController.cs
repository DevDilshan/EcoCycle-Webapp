using System.Security.Claims;
using backend.DTOs;
using backend.Models;
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

    // GET /api/approvals - the admin Approval Dashboard list, newest first.
    // Filter with ?status=Pending and page with ?page=&pageSize= (see ApprovalQueryParams).
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ApprovalResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList([FromQuery] ApprovalQueryParams query)
    {
        // Enum query binding can fail on some hosts; always honor ?status=Pending.
        if (!query.Status.HasValue)
        {
            var raw = Request.Query["status"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(raw)
                && Enum.TryParse<ApprovalStatus>(raw, ignoreCase: true, out var parsed))
            {
                query.Status = parsed;
            }
        }

        return Ok(await _service.GetListAsync(query));
    }

    // GET /api/approvals/{id} - one approval with the agent's classification and
    // recommendation, for the admin review screen.
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApprovalDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    // POST /api/approvals/{id}/approve — admin approves a flagged request
    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveApprovalDto? dto)
    {
        dto ??= new ApproveApprovalDto();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        try
        {
            var result = await _service.ApproveAsync(id, CurrentUserId, dto);
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
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

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

    // POST /api/approvals/{id}/request-revision — admin asks resident to update and resubmit
    [HttpPost("{id:guid}/request-revision")]
    public async Task<IActionResult> RequestRevision(Guid id, [FromBody] RequestRevisionDto dto)
    {
        try
        {
            var result = await _service.RequestRevisionAsync(id, CurrentUserId, dto);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
