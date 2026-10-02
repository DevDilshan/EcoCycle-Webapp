using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddZoneCollectionDaysAndCollectorSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing zones have no value for this, and the column is NOT NULL,
            // so it needs a default: without one Postgres refuses the whole
            // migration with "contains null values". An empty array is the right
            // default anyway -- it means "no fixed collection days", which is
            // exactly what these zones had before.
            migrationBuilder.AddColumn<List<int>>(
                name: "CollectionDays",
                table: "Zones",
                type: "integer[]",
                nullable: false,
                defaultValue: new List<int>());

            migrationBuilder.CreateTable(
                name: "CollectorSettings",
                columns: table => new
                {
                    CollectorId = table.Column<Guid>(type: "uuid", nullable: false),
                    DailyCapacity = table.Column<int>(type: "integer", nullable: false),
                    HandlesBulky = table.Column<bool>(type: "boolean", nullable: false),
                    HandlesHazardous = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CollectorSettings", x => x.CollectorId);
                    table.ForeignKey(
                        name: "FK_CollectorSettings_profiles_CollectorId",
                        column: x => x.CollectorId,
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CollectorSettings");

            migrationBuilder.DropColumn(
                name: "CollectionDays",
                table: "Zones");
        }
    }
}
