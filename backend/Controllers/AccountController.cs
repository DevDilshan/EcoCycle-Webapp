using System.Security.Claims;
using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

// Self-service account management. Any authenticated role (resident, collector,
// admin) may delete their OWN account — never anyone else's, since the user id
// is read from the JWT, not from the request body.
[ApiController]
[Route("api/account")]
[Authorize]
public class AccountController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ApplicationDbContext _db;

    public AccountController(IHttpClientFactory httpClientFactory, ApplicationDbContext db)
    {
        _httpClientFactory = httpClientFactory;
        _db = db;
    }

    private Guid CurrentUserId
    {
        get
        {
            var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            return Guid.TryParse(sub, out var id)
                ? id
                : throw new UnauthorizedAccessException("Missing/invalid sub claim.");
        }
    }

    // DELETE /api/account — permanently delete the signed-in user's own account.
    [HttpDelete]
    public async Task<IActionResult> DeleteOwnAccount()
    {
        var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL")?.TrimEnd('/');
        var serviceKey = Environment.GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");
        if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(serviceKey))
        {
            return StatusCode(500, new
            {
                message = "Account deletion is not configured on the server "
                        + "(missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)."
            });
        }

        var userId = CurrentUserId;

        // Delete the Supabase auth user via the Admin API. The service-role key
        // is required for this and must never leave the server. Removing the
        // auth user cascades the profiles row and the user's app data through
        // the database foreign keys.
        var client = _httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Delete, $"{supabaseUrl}/auth/v1/admin/users/{userId}");
        request.Headers.Add("apikey", serviceKey);
        request.Headers.Add("Authorization", $"Bearer {serviceKey}");

        var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadAsStringAsync();
            return StatusCode((int)response.StatusCode, new
            {
                message = "Failed to delete account.",
                detail,
            });
        }

        // Safety net: if the auth-user deletion did not cascade the profiles row
        // (and, through it, the user's app data), remove it here. Best-effort —
        // the account is already gone from auth, so cleanup errors are ignored.
        try
        {
            var profile = await _db.Profiles.FirstOrDefaultAsync(p => p.Id == userId);
            if (profile is not null)
            {
                _db.Profiles.Remove(profile);
                await _db.SaveChangesAsync();
            }
        }
        catch
        {
            // Ignore: the authoritative deletion (auth user) already succeeded.
        }

        return NoContent();
    }
}
