using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddRewardItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RewardItemId",
                table: "RedemptionRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RewardItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PointsCost = table.Column<int>(type: "integer", nullable: false),
                    Stock = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RewardItems", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RedemptionRequests_RewardItemId",
                table: "RedemptionRequests",
                column: "RewardItemId");

            migrationBuilder.CreateIndex(
                name: "IX_RewardItems_IsActive_PointsCost",
                table: "RewardItems",
                columns: new[] { "IsActive", "PointsCost" });

            migrationBuilder.AddForeignKey(
                name: "FK_RedemptionRequests_RewardItems_RewardItemId",
                table: "RedemptionRequests",
                column: "RewardItemId",
                principalTable: "RewardItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RedemptionRequests_RewardItems_RewardItemId",
                table: "RedemptionRequests");

            migrationBuilder.DropTable(
                name: "RewardItems");

            migrationBuilder.DropIndex(
                name: "IX_RedemptionRequests_RewardItemId",
                table: "RedemptionRequests");

            migrationBuilder.DropColumn(
                name: "RewardItemId",
                table: "RedemptionRequests");
        }
    }
}
