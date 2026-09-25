using System.Globalization;
using backend.DTOs;
using backend.Models;

namespace backend.Services;

/// <summary>
/// Turns the routing agent's JSON decision into a RouteAssignment.
/// </summary>
/// <remarks>
/// Shared by the two paths that route a pickup: PickupRequestService when a
/// clean pickup is submitted, and ApprovalService when an admin approves a
/// flagged one. Kept in one place so both apply the same validation -- an LLM
/// can return a collector id that is not a Guid or a date that will not parse,
/// and either would become a foreign-key violation or a bad schedule if it
/// reached the database unchecked.
/// </remarks>
public static class AgentRoutingMapper
{
    /// <summary>
    /// Builds a RouteAssignment, or explains why the agent's decision is unusable.
    /// </summary>
    /// <param name="error">Null on success; otherwise an admin-readable reason.</param>
    public static bool TryBuild(
        Guid pickupRequestId,
        Guid zoneId,
        RoutingDto? routing,
        out RouteAssignment? assignment,
        out string? error)
    {
        assignment = null;
        error = null;

        if (routing is null)
        {
            error = "The agent service returned no routing decision.";
            return false;
        }

        if (!Guid.TryParse(routing.CollectorId, out var collectorId))
        {
            error = $"The agent chose collector '{routing.CollectorId}', which is not a valid id.";
            return false;
        }

        if (!DateTime.TryParse(
                routing.ScheduledDate, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var scheduledDate))
        {
            error = $"The agent returned scheduled date '{routing.ScheduledDate}', which is not a date.";
            return false;
        }

        assignment = new RouteAssignment
        {
            PickupRequestId = pickupRequestId,
            CollectorId = collectorId,
            ZoneId = zoneId,
            ScheduledDate = DateTime.SpecifyKind(scheduledDate, DateTimeKind.Utc),
            CompletionStatus = RouteCompletionStatus.Pending
        };
        return true;
    }
}
