using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class ChangeZoneRouteAssignmentDeleteBehavior : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RouteAssignments_Zones_ZoneId",
                table: "RouteAssignments");

            migrationBuilder.AddForeignKey(
                name: "FK_RouteAssignments_Zones_ZoneId",
                table: "RouteAssignments",
                column: "ZoneId",
                principalTable: "Zones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RouteAssignments_Zones_ZoneId",
                table: "RouteAssignments");

            migrationBuilder.AddForeignKey(
                name: "FK_RouteAssignments_Zones_ZoneId",
                table: "RouteAssignments",
                column: "ZoneId",
                principalTable: "Zones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
