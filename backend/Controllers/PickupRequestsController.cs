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
    private readonly PickupSchedulingService _scheduling;
    private readonly IComplianceService _complianceService;

    public PickupRequestsController(
        IPickupRequestService service,
        IComplianceService complianceService,
        PickupSchedulingService scheduling)
    {
        _service = service;
        _complianceService = complianceService;
        _scheduling = scheduling;
    }

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
    private bool IsCollector => User.IsInRole("collector");

    // POST /api/pickuprequests/{id}/request-again — the resident says the
    // collection did not happen, so book it onto a round again.
    [HttpPost("{id:guid}/request-again")]
    [Authorize(Roles = "resident")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RequestAgain(Guid id)
    {
        var eligibility = await _service.CanRequestAgainAsync(CurrentUserId, id);
        if (eligibility.NotFound) return NotFound();
        if (eligibility.Reason is not null) return BadRequest(new { message = eligibility.Reason });

        var error = await _scheduling.ScheduleAsync(id);
        return error is null
            ? Ok(new { message = "Booked onto a collector's round again." })
            : BadRequest(new { message = error });
    }

    // GET /api/pickuprequests/bulk-allowance — what is left of the resident's
    // bulky-waste allowance this month, so the form can say so before they book.
    [HttpGet("bulk-allowance")]
    [Authorize(Roles = "resident")]
    [ProducesResponseType(typeof(BulkAllowanceDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<BulkAllowanceDto>> GetBulkAllowance()
        => Ok(await _service.GetBulkAllowanceAsync(CurrentUserId));

    // POST /api/pickuprequests  — resident creates a request
    [HttpPost]
    [Authorize(Roles = "resident")]
    public async Task<IActionResult> Create([FromBody] CreatePickupRequestDto dto)
    {
        try
        {
            var created = await _service.CreateAsync(CurrentUserId, dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            // An unusable zone is the resident's input being wrong, not a server
            // fault, so it answers 400 with the reason rather than a bare 500.
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST /api/pickuprequests/{id}/classify — stub classifier: sets category + moves Pending -> Classified
    [HttpPost("{id:guid}/classify")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Classify(Guid id)
    {
        try
        {
            var result = await _service.ClassifyAsync(id);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message }); // 409: not in Pending state
        }
    }

    // GET /api/pickuprequests  — admin sees all, resident sees own (filter/sort/paging)
    [HttpGet]
    [Authorize(Roles = "admin,resident,collector")]
    public async Task<IActionResult> GetList([FromQuery] PickupRequestQueryParams query)
    {
        var result = await _service.GetListAsync(CurrentUserId, IsAdmin, IsCollector, query);
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
        if (dto.PreferredDate.Date < DateTime.UtcNow.Date)
            return BadRequest(new { message = "PreferredDate cannot be in the past." });
            
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

    // POST /api/pickuprequests/{id}/classify-evaluate — simulate AI classification + compliance flagging
    // (/classify itself is the Student 1 stub above; two actions on one route break Swagger and routing)
    // Admin only, for the same reason as /classify above: the Classifier agent
    // runs on submission, so a manual re-run is a fallback for a failed pipeline
    // rather than part of a collector's round.
    [HttpPost("{id:guid}/classify-evaluate")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Classify(Guid id, [FromBody] ClassifyPickupRequestDto dto)
    {
        try
        {
            var result = await _complianceService.ClassifyAndEvaluateAsync(id, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}