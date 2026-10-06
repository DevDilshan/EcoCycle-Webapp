using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddRewardDelivery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Delivery",
                table: "RewardItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryInstructions",
                table: "RewardItems",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CollectionCode",
                table: "RedemptionRequests",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Delivery",
                table: "RedemptionRequests",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryAddress",
                table: "RedemptionRequests",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryInstructions",
                table: "RedemptionRequests",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FulfilledAt",
                table: "RedemptionRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RedemptionRequests_CollectionCode",
                table: "RedemptionRequests",
                column: "CollectionCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RedemptionRequests_CollectionCode",
                table: "RedemptionRequests");

            migrationBuilder.DropColumn(
                name: "Delivery",
                table: "RewardItems");

            migrationBuilder.DropColumn(
                name: "DeliveryInstructions",
                table: "RewardItems");

            migrationBuilder.DropColumn(
                name: "CollectionCode",
                table: "RedemptionRequests");

            migrationBuilder.DropColumn(
                name: "Delivery",
                table: "RedemptionRequests");

            migrationBuilder.DropColumn(
                name: "DeliveryAddress",
                table: "RedemptionRequests");

            migrationBuilder.DropColumn(
                name: "DeliveryInstructions",
                table: "RedemptionRequests");

            migrationBuilder.DropColumn(
                name: "FulfilledAt",
                table: "RedemptionRequests");
        }
    }
}
