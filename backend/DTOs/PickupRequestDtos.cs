using System.ComponentModel.DataAnnotations;
using backend.Models;

namespace backend.DTOs;

// What the resident sends to CREATE a request
public class CreatePickupRequestDto
{
    public string? PhotoUrl { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Required]
    public DateTime PreferredDate { get; set; }

    public bool IsRecurring { get; set; } = false;
    public string? RecurrenceInterval { get; set; }
}

// What the resident sends to EDIT a pending request
public class UpdatePickupRequestDto
{
    public string? PhotoUrl { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Required]
    public DateTime PreferredDate { get; set; }

    public bool IsRecurring { get; set; } = false;
    public string? RecurrenceInterval { get; set; }
}

// What the API RETURNS for a request (full detail)
public class PickupRequestResponseDto
{
    public Guid Id { get; set; }
    public Guid ResidentId { get; set; }
    public string? PhotoUrl { get; set; }
    public string? Description { get; set; }
    public DateTime PreferredDate { get; set; }
    public string Status { get; set; } = string.Empty;   // enum as string
    public bool IsRecurring { get; set; }
    public string? RecurrenceInterval { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Lightweight shape for the status-check endpoint
public class PickupStatusDto
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
}