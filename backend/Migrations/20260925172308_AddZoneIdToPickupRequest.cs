using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddZoneIdToPickupRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ZoneId",
                table: "PickupRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PickupRequests_ZoneId",
                table: "PickupRequests",
                column: "ZoneId");

            migrationBuilder.AddForeignKey(
                name: "FK_PickupRequests_Zones_ZoneId",
                table: "PickupRequests",
                column: "ZoneId",
                principalTable: "Zones",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PickupRequests_Zones_ZoneId",
                table: "PickupRequests");

            migrationBuilder.DropIndex(
                name: "IX_PickupRequests_ZoneId",
                table: "PickupRequests");

            migrationBuilder.DropColumn(
                name: "ZoneId",
                table: "PickupRequests");
        }
    }
}
