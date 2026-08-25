using Microsoft.EntityFrameworkCore;
using backend.Models;

namespace backend.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<PickupRequest> PickupRequests => Set<PickupRequest>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<Zone> Zones => Set<Zone>();
    public DbSet<RouteAssignment> RouteAssignments => Set<RouteAssignment>();
    public DbSet<Complaint> Complaints => Set<Complaint>();
    public DbSet<ApprovalRequest> ApprovalRequests => Set<ApprovalRequest>();
    public DbSet<RewardPoint> RewardPoints => Set<RewardPoint>();
    public DbSet<ComplianceViolation> ComplianceViolations => Set<ComplianceViolation>();
    public DbSet<WasteClassification> WasteClassifications => Set<WasteClassification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // profiles already exists in Supabase — don't let migrations touch it
        modelBuilder.Entity<Profile>().ToTable("profiles", t => t.ExcludeFromMigrations());

        modelBuilder.Entity<PickupRequest>()
            .HasOne(p => p.Resident)
            .WithMany()
            .HasForeignKey(p => p.ResidentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Zone>()
            .HasOne(z => z.AssignedCollector)
            .WithMany()
            .HasForeignKey(z => z.AssignedCollectorId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<RouteAssignment>()
            .HasOne(r => r.PickupRequest)
            .WithMany()
            .HasForeignKey(r => r.PickupRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RouteAssignment>()
            .HasOne(r => r.Collector)
            .WithMany()
            .HasForeignKey(r => r.CollectorId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RouteAssignment>()
            .HasOne(r => r.Zone)
            .WithMany()
            .HasForeignKey(r => r.ZoneId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Complaint>()
            .HasOne(c => c.Resident)
            .WithMany()
            .HasForeignKey(c => c.ResidentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Complaint>()
            .HasOne(c => c.PickupRequest)
            .WithMany()
            .HasForeignKey(c => c.PickupRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ApprovalRequest>()
            .HasOne(a => a.PickupRequest)
            .WithMany()
            .HasForeignKey(a => a.PickupRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ApprovalRequest>()
            .HasOne(a => a.ReviewedByAdmin)
            .WithMany()
            .HasForeignKey(a => a.ReviewedByAdminId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ApprovalRequest>()
            .HasIndex(a => a.PickupRequestId)
            .IsUnique();
        modelBuilder.Entity<RewardPoint>()
            .HasOne(r => r.Resident)
            .WithMany()
            .HasForeignKey(r => r.ResidentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RewardPoint>()
            .HasOne(r => r.PickupRequest)
            .WithMany()
            .HasForeignKey(r => r.PickupRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ComplianceViolation>()
            .HasOne(v => v.Resident)
            .WithMany()
            .HasForeignKey(v => v.ResidentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ComplianceViolation>()
            .HasOne(v => v.PickupRequest)
            .WithMany()
            .HasForeignKey(v => v.PickupRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<WasteClassification>()
              .HasOne(w => w.PickupRequest)
              .WithMany()
              .HasForeignKey(w => w.PickupRequestId)
              .OnDelete(DeleteBehavior.Cascade);

    }
}
