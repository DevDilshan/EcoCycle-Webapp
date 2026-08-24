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
    }
}