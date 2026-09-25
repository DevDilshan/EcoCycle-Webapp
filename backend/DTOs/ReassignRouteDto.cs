using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class ReassignRouteDto
{
    [Required]
    public Guid NewCollectorId { get; set; }
}
