using backend.DTOs;

namespace backend.Services;

/// <summary>
/// Talks to the Python agent service (Classifier -> Validator -> Routing -> Notifier).
/// </summary>
/// <remarks>
/// Both methods return null when the service is unreachable or times out, so a
/// caller can degrade gracefully rather than failing a resident's submission.
/// They throw when the service answers but rejects the request (4xx/5xx), because
/// that is a bug in our call, not an outage, and should not be silently swallowed.
/// </remarks>
public interface IAgentPipelineClient
{
    Task<PipelineResultDto?> RunPipelineAsync(
        RunPipelineRequestDto request, CancellationToken cancellationToken = default);

    Task<RoutingDto?> RouteApprovedPickupAsync(
        RouteApprovedPickupRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Picks a collector and day for a pickup that is already classified -- a
    /// missed stop, a second attempt, or the next recurring collection.
    /// </summary>
    Task<RoutingDto?> ChooseSlotAsync(
        RoutingContextDto context, CancellationToken cancellationToken = default);
}
