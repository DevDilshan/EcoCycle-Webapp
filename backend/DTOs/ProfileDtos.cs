namespace backend.DTOs;

public class ProfileResponseDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string Role { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class ProfileQueryParams
{
    public string? Role { get; set; }
}
