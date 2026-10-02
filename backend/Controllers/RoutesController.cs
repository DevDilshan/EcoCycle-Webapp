
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
        var route = await _routeService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetTodayRoute), new { collectorId = route.CollectorId }, route);
    }

    [HttpGet("{collectorId:guid}/today")]
    [ProducesResponseType(typeof(List<RouteAssignmentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<RouteAssignmentDto>>> GetTodayRoute(Guid collectorId)
    {
        var routes = await _routeService.GetTodayRouteForCollectorAsync(collectorId);
        return Ok(routes);
    }

    // GET /api/routes/{collectorId}/upcoming?days=7 — stops after today, so a
    // collector can see what is coming rather than only the current day.
    [HttpGet("{collectorId:guid}/upcoming")]
    [ProducesResponseType(typeof(List<RouteAssignmentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<RouteAssignmentDto>>> GetUpcomingRoute(
        Guid collectorId,
        [FromQuery] int days = 7)
    {
        var routes = await _routeService.GetUpcomingRouteForCollectorAsync(collectorId, days);
        return Ok(routes);
    }

    [HttpPatch("{id:guid}/complete")]
    [ProducesResponseType(typeof(RouteAssignmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RouteAssignmentDto>> Complete(Guid id, [FromBody] CompleteRouteDto? dto)
    {
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
    [HttpGet("day")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(List<RouteAssignmentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<RouteAssignmentDto>>> GetDay([FromQuery] DateTime? date)
    {
        var routes = await _routeService.GetAssignmentsForDayAsync(date);
        return Ok(routes);
    }

    // PATCH /api/routes/{id}/missed — admin-only. A collector marks work done;
    // an admin accounts for work that was not, which is the only way a Missed
    // row can come into existence.
    [HttpPatch("{id:guid}/missed")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(RouteAssignmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RouteAssignmentDto>> MarkMissed(Guid id, [FromBody] CompleteRouteDto? dto)
    {
        try
        {
            var route = await _routeService.MarkMissedAsync(id, dto?.IssueNotes);
            if (route is null) return NotFound();

            // A missed stop is not the end of the pickup -- the rubbish is still
            // outside the house. Book it again straight away rather than leaving
            // it for someone to notice, which is what used to happen.
            var rescheduleError = await _scheduling.ScheduleAsync(route.PickupRequestId);

            return Ok(new
            {
                route,
                rescheduled = rescheduleError is null,
                rescheduleMessage = rescheduleError
            });
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
        var route = await _routeService.ReassignAsync(id, dto.NewCollectorId);
        return route is null ? NotFound() : Ok(route);
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
