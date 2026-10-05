using backend.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace backend.Tests.Database;

// Brings up a REAL PostgreSQL database for the integration tests that InMemory
// cannot stand in for (column constraints, timestamptz behaviour, migrations,
// transactions). It uses a local server rather than Testcontainers so it needs
// no Docker.
//
// Connection string: TEST_POSTGRES_CONNECTION if set, otherwise a local default
// (the current OS user against localhost, which is how Homebrew Postgres is set
// up). If no server can be reached -- as on CI, which runs only `dotnet test` --
// the fixture reports Available=false and every test Skip()s instead of failing.
//
// On start it creates a fresh, uniquely named database, adds the minimal
// `profiles` table the migrations' foreign keys point at (profiles is managed by
// Supabase, not by migrations), then applies every migration. On dispose it
// drops that database.
public sealed class PostgresFixture : IAsyncLifetime
{
    public bool Available { get; private set; }
    public string SkipReason { get; private set; } = "";
    public string ConnectionString { get; private set; } = "";

    private string _adminConnectionString = "";
    private readonly string _dbName = $"ecocycle_pickup_test_{Guid.NewGuid():N}";

    public ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(ConnectionString)
            .Options);

    public async Task InitializeAsync()
    {
        var baseConn = Environment.GetEnvironmentVariable("TEST_POSTGRES_CONNECTION")
            ?? $"Host=localhost;Port=5432;Username={Environment.UserName};Database=postgres";

        try
        {
            var adminBuilder = new NpgsqlConnectionStringBuilder(baseConn);
            var maintenanceDb = string.IsNullOrWhiteSpace(adminBuilder.Database) ? "postgres" : adminBuilder.Database;
            adminBuilder.Database = maintenanceDb;
            _adminConnectionString = adminBuilder.ConnectionString;

            // Fail fast if no server is listening, so CI skips rather than hangs.
            adminBuilder.Timeout = 3;

            await using (var admin = new NpgsqlConnection(adminBuilder.ConnectionString))
            {
                await admin.OpenAsync();
                await using var create = admin.CreateCommand();
                create.CommandText = $"CREATE DATABASE \"{_dbName}\"";
                await create.ExecuteNonQueryAsync();
            }

            var testBuilder = new NpgsqlConnectionStringBuilder(adminBuilder.ConnectionString) { Database = _dbName };
            ConnectionString = testBuilder.ConnectionString;

            // profiles lives in Supabase and is excluded from migrations, but the
            // pickup/zone/complaint foreign keys reference it, so it must exist
            // before Migrate() runs. Only id is needed as the FK target.
            await using (var testConn = new NpgsqlConnection(ConnectionString))
            {
                await testConn.OpenAsync();
                await using var profiles = testConn.CreateCommand();
                profiles.CommandText =
                    "CREATE TABLE IF NOT EXISTS public.profiles (" +
                    "id uuid PRIMARY KEY, email text, \"FullName\" text, role text, " +
                    "created_at timestamptz, updated_at timestamptz)";
                await profiles.ExecuteNonQueryAsync();
            }

            await using (var db = NewContext())
            {
                await db.Database.MigrateAsync();
            }

            Available = true;
        }
        catch (Exception ex)
        {
            Available = false;
            SkipReason = $"No test PostgreSQL available ({ex.GetType().Name}: {ex.Message}). " +
                         "Set TEST_POSTGRES_CONNECTION or start a local server to run these tests.";
        }
    }

    // Inserts a minimal profile row so a pickup's ResidentId FK is satisfied.
    // A specific id can be supplied so it matches the authenticated test user.
    public async Task<Guid> AddProfileAsync(Guid? profileId = null)
    {
        var id = profileId ?? Guid.NewGuid();
        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO public.profiles (id, email, role) VALUES ($1, $2, $3)";
        cmd.Parameters.AddWithValue(id);
        cmd.Parameters.AddWithValue($"{id:N}@test.local");
        cmd.Parameters.AddWithValue("resident");
        await cmd.ExecuteNonQueryAsync();
        return id;
    }

    public async Task DisposeAsync()
    {
        if (!Available) return;
        try
        {
            await using var admin = new NpgsqlConnection(_adminConnectionString);
            await admin.OpenAsync();
            // Drop any lingering connections to the test DB, then drop it.
            await using var drop = admin.CreateCommand();
            drop.CommandText =
                $"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{_dbName}';" +
                $"DROP DATABASE IF EXISTS \"{_dbName}\"";
            await drop.ExecuteNonQueryAsync();
        }
        catch
        {
            // Best-effort cleanup; a leftover test DB is harmless.
        }
    }
}

[CollectionDefinition("Postgres")]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture> { }
