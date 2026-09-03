
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

    public RoutesController(RouteAssignmentService routeService)
    {
        _routeService = routeService;
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

    [HttpPatch("{id:guid}/complete")]
    [ProducesResponseType(typeof(RouteAssignmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RouteAssignmentDto>> Complete(Guid id, [FromBody] CompleteRouteDto? dto)
    {
        var route = await _routeService.MarkCompleteAsync(id, dto?.IssueNotes);
        return route is null ? NotFound() : Ok(route);
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
}
