namespace backend.DTOs;

public class CollectorLoadDto
{
    public Guid CollectorId { get; set; }

    public int TotalAssignments { get; set; }

    public int PendingAssignments { get; set; }

    public int CompletedAssignments { get; set; }

    public int MissedAssignments { get; set; }
}
