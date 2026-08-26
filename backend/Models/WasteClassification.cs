using System.ComponentModel.DataAnnotations;
  using System.ComponentModel.DataAnnotations.Schema;

  namespace backend.Models;

  public enum WasteCategory
  {
      Organic,
      Recyclable,
      Hazardous,
      EWaste,
      General
  }

  [Table("WasteClassifications")]
  public class WasteClassification
  {
      [Key]
      public Guid Id { get; set; } = Guid.NewGuid();

      [Required]
      public Guid PickupRequestId { get; set; }

      [ForeignKey(nameof(PickupRequestId))]
      public PickupRequest? PickupRequest { get; set; }

      [Required]
      public WasteCategory Category { get; set; }

      [Required]
      [Range(0, 1)]
      public double Confidence { get; set; }

      [Required]
      [MaxLength(2000)]
      public string Reasoning { get; set; } = string.Empty;

      public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
  }