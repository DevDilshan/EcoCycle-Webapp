using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.DTOs;
using backend.Services;

namespace backend.Controllers;

[ApiController]
[Route("api/routes")]
[Authorize]
public class RoutesController : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id)
            ? id
            : Guid.Empty;

    private bool IsAdmin => User.IsInRole("admin");

    private readonly RouteAssignmentService _routeService;
    private readonly PickupSchedulingService _scheduling;

    public RoutesController(RouteAssignmentService routeService,
        PickupSchedulingService scheduling)
    {
        _routeService = routeService;
        _scheduling = scheduling;
    }

    [HttpPost]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(RouteAssignmentDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<RouteAssignmentDto>> Create([FromBody] CreateRouteAssignmentDto dto)
    {
        try
        {
            var route = await _routeService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetTodayRoute), new { collectorId = route.CollectorId }, route);
        }
        catch (ArgumentException ex)
        {
            // The message names what is wrong -- a retired zone, a pickup already
            // on a round. Swallowing it to a bare 500 left an admin guessing.
            return BadRequest(new { message = ex.Message });
        }
    }

    // A round is the collector's own, or an admin's to look at. It lists the
    // route ids that complete/missed act on, so it is not for anyone else.
    [HttpGet("{collectorId:guid}/today")]
    [Authorize(Roles = "admin,collector")]
    [ProducesResponseType(typeof(List<RouteAssignmentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<RouteAssignmentDto>>> GetTodayRoute(Guid collectorId)
    {
        if (!IsAdmin && collectorId != CurrentUserId) return Forbid();

        var routes = await _routeService.GetTodayRouteForCollectorAsync(collectorId);
        return Ok(routes);
    }

    // GET /api/routes/{collectorId}/upcoming?days=7 — stops after today, so a
    // collector can see what is coming rather than only the current day.
    [HttpGet("{collectorId:guid}/upcoming")]
    [Authorize(Roles = "admin,collector")]
    [ProducesResponseType(typeof(List<RouteAssignmentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<RouteAssignmentDto>>> GetUpcomingRoute(
        Guid collectorId,
        [FromQuery] int days = 7)
    {
        if (!IsAdmin && collectorId != CurrentUserId) return Forbid();

        var routes = await _routeService.GetUpcomingRouteForCollectorAsync(collectorId, days);
        return Ok(routes);
    }

    [HttpPatch("{id:guid}/complete")]
    [Authorize(Roles = "admin,collector")]
    [ProducesResponseType(typeof(RouteAssignmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RouteAssignmentDto>> Complete(Guid id, [FromBody] CompleteRouteDto? dto)
    {
        // Completing a stop pays the resident their points, so it has to come
        // from the collector who made the collection -- not from the resident,
        // and not from another collector.
        if (!IsAdmin)
        {
            var isTheirs = await _routeService.IsAssignedToAsync(id, CurrentUserId);
            if (!isTheirs) return Forbid();
        }

        var route = await _routeService.MarkCompleteAsync(id, dto?.IssueNotes);
        if (route is null) return NotFound();

        // A recurring collection creates its next occurrence when this one is
        // actually made. Booking it onto a round takes an agent call, so it
        // happens after the collector's save and never blocks or fails their
        // action -- an unbooked occurrence is still visible to an admin.
        if (_routeService.NextRecurringPickupId is Guid nextId)
        {
            await _scheduling.ScheduleAsync(nextId);
        }

        return Ok(route);
    }

    // GET /api/routes/day?date=2026-09-29 — every stop on one day, across all
    // collectors, so an admin can see the round rather than one collector's view.
    // GET /api/routes/overdue — pending stops too old to still be on a round.
    //
    // Admin-only, and deliberately so: these are the stops a collector can no
    // longer act on, and what they need is someone to reassign them or account
    // for them. A collector seeing them again would be no more able to collect
    // them than they were a week ago.
    [HttpGet("overdue")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(List<RouteAssignmentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<RouteAssignmentDto>>> GetOverdue()
        => Ok(await _routeService.GetOverdueStopsAsync());

    [HttpGet("day")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(List<RouteAssignmentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<RouteAssignmentDto>>> GetDay([FromQuery] DateTime? date)
    {
        var routes = await _routeService.GetAssignmentsForDayAsync(date);
        return Ok(routes);
    }

    // PATCH /api/routes/{id}/missed — the collector reports it, the admin can
    // too.
    //
    // The collector is the one standing at the kerb: they are the only person
    // who knows the bin was not out or the gate was locked. Leaving this to an
    // admin meant nobody could record it until someone noticed days later. The
    // admin keeps the ability for the case the collector never reports it --
    // which is the same case a resident complains about.
    [HttpPatch("{id:guid}/missed")]
    [Authorize(Roles = "admin,collector")]
    [ProducesResponseType(typeof(RouteAssignmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RouteAssignmentDto>> MarkMissed(Guid id, [FromBody] CompleteRouteDto? dto)
    {
        // A collector may only report their own stop. Without this one collector
        // could close off another's round, and the reason recorded against it
        // would be from someone who was never there.
        if (!IsAdmin)
        {
            var isTheirs = await _routeService.IsAssignedToAsync(id, CurrentUserId);
            if (!isTheirs) return Forbid();
        }

        try
        {
            var route = await _routeService.MarkMissedAsync(id, dto?.IssueNotes);
            if (route is null) return NotFound();

            // A missed stop is not the end of the pickup -- the rubbish is still
            // outside the house. Book it again straight away rather than leaving
            // it for someone to notice, which is what used to happen.
            var rescheduleError = await _scheduling.ScheduleAsync(route.PickupRequestId);

            // Rewrite the crew's shorthand for the household, once the new date
            // is known so the message can name it. Best-effort: losing the
            // friendly wording must not lose the report itself.
            await _scheduling.WriteResidentMessageAsync(
                route.PickupRequestId, dto?.IssueNotes);

            return Ok(new
            {
                route,
                rescheduled = rescheduleError is null,
                rescheduleMessage = rescheduleError
            });
        }
        catch (ArgumentException ex)
        {
            // A missing reason is a bad request, not a state conflict.
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}/reassign")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(RouteAssignmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RouteAssignmentDto>> Reassign(Guid id, [FromBody] ReassignRouteDto dto)
    {
        try
        {
            var route = await _routeService.ReassignAsync(id, dto.NewCollectorId);
            return route is null ? NotFound() : Ok(route);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            // 409: the stop exists and the request is well formed, but its state
            // does not allow this -- a completed stop cannot change hands.
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("load-report")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(List<CollectorLoadDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CollectorLoadDto>>> GetLoadReport()
    {
        var report = await _routeService.GetLoadReportAsync();
        return Ok(report);
    }

    [HttpGet("zone-load")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(List<ZoneLoadDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ZoneLoadDto>>> GetZoneLoadReport()
    {
        var report = await _routeService.GetZoneLoadReportAsync();
        return Ok(report);
    }

    // Admin only. The Router agent assigns pickups automatically when an approval
    // is granted; this stays as the manual fallback for a pickup the pipeline
    // failed to route, which is an admin's job, not a collector's.
    [HttpPost("assign/{pickupRequestId:guid}")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(RouteAssignmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<RouteAssignmentDto>> AssignPickupToRoute(Guid pickupRequestId)
    {
        try
        {
            var route = await _routeService.AssignPickupToRouteAsync(pickupRequestId);
            return route is null
                ? NotFound(new { message = "Pickup request not found." })
                : CreatedAtAction(nameof(GetTodayRoute), new { collectorId = route.CollectorId }, route);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
