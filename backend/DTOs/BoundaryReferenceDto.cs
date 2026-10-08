using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

/// <summary>Lineage of an administrative outline used to plan a collection zone.</summary>
public class BoundaryReferenceDto
{
    [Required, MaxLength(40)]
    public string DatasetId { get; set; } = string.Empty;
    [Required, MaxLength(20), RegularExpression("^LK[0-9]{4}([0-9]{3})?$")]
    public string AreaCode { get; set; } = string.Empty;
    [Required, MaxLength(150)]
    public string AreaName { get; set; } = string.Empty;
    [Range(3, 4)]
    public int AdministrativeLevel { get; set; }
    public bool AdjustedByAdmin { get; set; }
}
