using Microsoft.EntityFrameworkCore;
using backend.Models;

namespace backend.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<PickupRequest> PickupRequests => Set<PickupRequest>();
    public DbSet<Profile> Profiles => Set<Profile>();

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
    }
}