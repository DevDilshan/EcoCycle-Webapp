using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace backend.Tests.Integration;

// A stand-in for the real Supabase JWT bearer handler, used only in tests.
// It turns two request headers into an authenticated user, so a test can act as
// any role without minting a real token:
//   X-Test-Role: resident | collector | admin   (omit to stay anonymous -> 401)
//   X-Test-Sub:  the user's GUID                 (defaults to a fixed test id)
// This keeps the auth/authz tests hermetic -- no network, no JWKS, no secrets --
// while still exercising the real [Authorize(Roles = ...)] checks on the
// controllers, which is what the "authentication/authorization" evidence needs.
public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";
    public const string RoleHeader = "X-Test-Role";
    public const string SubHeader = "X-Test-Sub";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // No role header -> treat the caller as anonymous so [Authorize] returns
        // 401, exactly as a missing bearer token would in production.
        if (!Request.Headers.TryGetValue(RoleHeader, out var role) || string.IsNullOrWhiteSpace(role))
            return Task.FromResult(AuthenticateResult.NoResult());

        var sub = Request.Headers.TryGetValue(SubHeader, out var s) && !string.IsNullOrWhiteSpace(s)
            ? s.ToString()
            : "00000000-0000-0000-0000-000000000001";

        var claims = new[]
        {
            new Claim("sub", sub),
            new Claim(ClaimTypes.NameIdentifier, sub),
            new Claim(ClaimTypes.Role, role.ToString()),
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
