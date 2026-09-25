using System.Text.Json;
using System.Text.Json.Serialization;

namespace backend.Services;

/// <summary>
/// The JSON conventions the Python agent service uses.
/// </summary>
/// <remarks>
/// Shared so that reading a stored PipelineResultJson uses exactly the same
/// options as the call that produced it. Python emits snake_case; if these two
/// ever diverged, stored results would silently deserialise into empty objects
/// rather than failing loudly.
/// </remarks>
public static class AgentJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}
