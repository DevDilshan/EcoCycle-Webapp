using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CompleteRouteDto
{
    [MaxLength(500)]
    public string? IssueNotes { get; set; }
}
