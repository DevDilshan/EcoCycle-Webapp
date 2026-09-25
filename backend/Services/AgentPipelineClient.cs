using System.Net.Http.Json;
using System.Text.Json;
using backend.DTOs;

namespace backend.Services;

/// <summary>
/// HTTP client for the Python agent service. Registered with AddHttpClient in
/// Program.cs so it gets a pooled, factory-managed HttpClient.
/// </summary>
public class AgentPipelineClient : IAgentPipelineClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AgentPipelineClient> _logger;

    public AgentPipelineClient(HttpClient http, ILogger<AgentPipelineClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<PipelineResultDto?> RunPipelineAsync(
        RunPipelineRequestDto request, CancellationToken cancellationToken = default)
    {
        // The raw body is kept as well as the parsed result: ApprovalRequest
        // stores it verbatim, and re-serialising our DTOs would quietly drop any
        // field Python adds that we do not model yet.
        var raw = await PostForRawJsonAsync("/run-pipeline", request, cancellationToken);
        if (raw is null) return null;

        var result = JsonSerializer.Deserialize<PipelineResultDto>(raw, AgentJson.Options)
                     ?? throw new InvalidOperationException("Agent service returned an empty pipeline result.");
        result.RawJson = raw;
        return result;
    }

    public async Task<RoutingDto?> RouteApprovedPickupAsync(
        RouteApprovedPickupRequestDto request, CancellationToken cancellationToken = default)
    {
        var raw = await PostForRawJsonAsync("/route-approved-pickup", request, cancellationToken);
        return raw is null ? null : JsonSerializer.Deserialize<RoutingDto>(raw, AgentJson.Options);
    }

    /// <summary>
    /// POSTs and returns the response body, or null if the service could not be
    /// reached. Distinguishes an outage (null, caller degrades) from a rejected
    /// request (throws, because we sent something wrong).
    /// </summary>
    private async Task<string?> PostForRawJsonAsync(
        string path, object payload, CancellationToken cancellationToken)
    {
        HttpResponseMessage response;
        try
        {
            response = await _http.PostAsJsonAsync(path, payload, AgentJson.Options, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Agent service unreachable at {BaseAddress}{Path}", _http.BaseAddress, path);
            return null;
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            // TaskCanceledException here means the HttpClient timeout elapsed,
            // not that our caller cancelled -- hence the `when` guard.
            _logger.LogWarning(ex, "Agent service timed out after {Timeout} at {Path}", _http.Timeout, path);
            return null;
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                "Agent service returned {StatusCode} for {Path}: {Body}",
                (int)response.StatusCode, path, body);

            throw new HttpRequestException(
                $"Agent service returned {(int)response.StatusCode} for {path}: {body}");
        }

        return body;
    }
}
