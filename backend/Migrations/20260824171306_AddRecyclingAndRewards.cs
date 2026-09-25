using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddRecyclingAndRewards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ComplianceViolations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ResidentId = table.Column<Guid>(type: "uuid", nullable: false),
                    PickupRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    RuleViolated = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComplianceViolations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComplianceViolations_PickupRequests_PickupRequestId",
                        column: x => x.PickupRequestId,
                        principalTable: "PickupRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ComplianceViolations_profiles_ResidentId",
                        column: x => x.ResidentId,
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RewardPoints",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ResidentId = table.Column<Guid>(type: "uuid", nullable: false),
                    PickupRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    PointsEarned = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RewardPoints", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RewardPoints_PickupRequests_PickupRequestId",
                        column: x => x.PickupRequestId,
                        principalTable: "PickupRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RewardPoints_profiles_ResidentId",
                        column: x => x.ResidentId,
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ComplianceViolations_PickupRequestId",
                table: "ComplianceViolations",
                column: "PickupRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ComplianceViolations_ResidentId",
                table: "ComplianceViolations",
                column: "ResidentId");

            migrationBuilder.CreateIndex(
                name: "IX_RewardPoints_PickupRequestId",
                table: "RewardPoints",
                column: "PickupRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_RewardPoints_ResidentId",
                table: "RewardPoints",
                column: "ResidentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ComplianceViolations");

            migrationBuilder.DropTable(
                name: "RewardPoints");
        }
    }
}
