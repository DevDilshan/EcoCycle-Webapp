using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <summary>
    /// Reconstruction of a migration that was applied to the shared database on
    /// 2026-09-12 but whose file was never committed. Its id is reproduced exactly
    /// so that databases carrying the original row in __EFMigrationsHistory treat
    /// it as already applied, while a fresh database runs it and gets the columns.
    /// Do not renumber it.
    /// </summary>
    public partial class SyncComplaintApprovalNoteColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdminNotes",
                table: "Complaints",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewNotes",
                table: "ApprovalRequests",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdminNotes",
                table: "Complaints");

            migrationBuilder.DropColumn(
                name: "ReviewNotes",
                table: "ApprovalRequests");
        }
    }
}
