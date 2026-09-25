using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CreateRouteAssignmentDto
{
    [Required]
    public Guid PickupRequestId { get; set; }

    [Required]
    public Guid CollectorId { get; set; }

    [Required]
    public Guid ZoneId { get; set; }

    [Required]
    public DateTime ScheduledDate { get; set; }
}
