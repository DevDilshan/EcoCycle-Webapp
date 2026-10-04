namespace backend.DTOs;

/// <summary>
/// One legal way to collect a pickup: a specific collector on a specific day.
/// </summary>
/// <remarks>
/// Built in C#, not by the agent. Every option here is already known to be
/// possible -- the collector is equipped for the category, has capacity left
/// that day, and the day is one the zone is actually collected on. The agent's
/// job is to choose between valid options and say why, which it cannot get
/// dangerously wrong.
/// </remarks>
public class RoutingOptionDto
{
    public string CollectorId { get; set; } = string.Empty;
    public string CollectorName { get; set; } = string.Empty;

    /// <summary>The day, as "yyyy-MM-dd" in UTC.</summary>
    public string Date { get; set; } = string.Empty;

    /// <summary>Stops this collector still has free that day.</summary>
    public int RemainingCapacity { get; set; }

    /// <summary>The day is one of the zone's scheduled collection days.</summary>
    public bool IsCollectionDay { get; set; }

    /// <summary>Days from today, so the agent can weigh urgency.</summary>
    public int DaysAway { get; set; }
}

/// <summary>Everything the router needs to choose a slot.</summary>
public class RoutingContextDto
{
    public string Category { get; set; } = string.Empty;
    public string ZoneName { get; set; } = string.Empty;

    /// <summary>What the resident asked for, as "yyyy-MM-dd". May be null.</summary>
    public string? PreferredDate { get; set; }

    /// <summary>True when the category needs special handling (hazardous, bulky).</summary>
    public bool IsRestricted { get; set; }

    public List<RoutingOptionDto> Options { get; set; } = [];
}

/// <summary>Body for POST /choose-slot on the agent service.</summary>
public class ChooseSlotRequestDto
{
    public RoutingContextDto RoutingContext { get; set; } = new();
}
