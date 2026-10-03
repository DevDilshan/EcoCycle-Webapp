using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

/// <summary>
/// What a collector's round can take, for the admin screen and the router.
/// </summary>
public class CollectorSettingDto
{
    public Guid CollectorId { get; set; }
    public string CollectorName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    public int DailyCapacity { get; set; }
    public bool HandlesBulky { get; set; }
    public bool HandlesHazardous { get; set; }

    /// <summary>
    /// False when no row exists yet and these are the defaults, so the admin
    /// screen can say "not set up" rather than implying someone chose this.
    /// </summary>
    public bool IsConfigured { get; set; }
}

public class UpdateCollectorSettingDto
{
    [Range(1, 100, ErrorMessage = "Daily capacity must be between 1 and 100 stops.")]
    public int DailyCapacity { get; set; } = 10;

    public bool HandlesBulky { get; set; } = true;
    public bool HandlesHazardous { get; set; } = false;
}
