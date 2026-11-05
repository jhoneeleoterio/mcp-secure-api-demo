using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;

namespace AcmeCommerce.Mcp.Configuration;

public static class DemoTokenConfiguration
{
    private const string DemoSubject = "public-demo";
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(5);
    private static readonly string[] DemoReadScopes =
        [ToolScopes.CustomersRead, ToolScopes.OrdersRead, ToolScopes.InventoryRead];

    public static IServiceCollection AddMcpDemoTokens(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<DemoTokenIssuer>();
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("demo-token", context => RateLimitPartition.GetFixedWindowLimiter(
                ClientKey(context, configuration), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                context.User.FindFirst("sub")?.Value == DemoSubject
                    ? RateLimitPartition.GetConcurrencyLimiter(DemoSubject, _ => new ConcurrencyLimiterOptions
                    {
                        PermitLimit = 8,
                        QueueLimit = 0
                    })
                    : RateLimitPartition.GetNoLimiter("other"));
            options.AddPolicy("mcp-calls", context =>
                context.User.FindFirst("sub")?.Value == DemoSubject
                    ? RateLimitPartition.GetFixedWindowLimiter(DemoSubject, _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 120,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                        AutoReplenishment = true
                    })
                    : RateLimitPartition.GetNoLimiter("other"));
        });
        return services;
    }

    public static WebApplication UseMcpDemoOriginCheck(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            if (context.Request.Path == "/mcp/demo-token"
                && HttpMethods.IsPost(context.Request.Method)
                && context.Request.Headers.Origin is { Count: > 0 } origins
                && (!Uri.TryCreate(origins.ToString(), UriKind.Absolute, out var origin)
                    || !string.Equals(origin.Authority, context.Request.Host.Value, StringComparison.OrdinalIgnoreCase)))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }
            await next(context);
        });
        return app;
    }

    public static WebApplication MapMcpDemoTokens(this WebApplication app)
    {
        if (!app.Configuration.GetValue<bool>("McpDemoTokens:Enabled"))
            return app;

        app.MapPost("/mcp/demo-token", (HttpContext context, DemoTokenIssuer issuer) =>
        {
            context.Response.Headers.CacheControl = "no-store, max-age=0";
            context.Response.Headers.Pragma = "no-cache";
            return Results.Ok(issuer.Issue());
        }).RequireRateLimiting("demo-token");
        return app;
    }

    public sealed class DemoTokenIssuer(IConfiguration configuration)
    {
        private readonly string issuer = configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException("Jwt:Issuer is required.");
        private readonly string audience = configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException("Jwt:Audience is required.");
        private readonly byte[] signingKey = Convert.FromBase64String(configuration["Jwt:SigningKeyBase64"]
            ?? throw new InvalidOperationException("Jwt:SigningKeyBase64 is required."));

        public DemoTokenResponse Issue()
        {
            var now = DateTimeOffset.UtcNow;
            var expiresAt = now.Add(TokenLifetime);
            var claims = new[]
            {
                new Claim("sub", DemoSubject),
                new Claim("scope", string.Join(' ', DemoReadScopes)),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
            };
            var jwt = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                notBefore: now.UtcDateTime,
                expires: expiresAt.UtcDateTime,
                signingCredentials: new SigningCredentials(new SymmetricSecurityKey(signingKey), SecurityAlgorithms.HmacSha256));
            return new DemoTokenResponse(new JwtSecurityTokenHandler().WriteToken(jwt), expiresAt, DemoReadScopes.ToArray());
        }
    }

    private static string ClientKey(HttpContext context, IConfiguration configuration)
    {
        if (configuration.GetValue<bool>("McpDemoTokens:TrustProxyClientIp")
            && System.Net.IPAddress.TryParse(context.Request.Headers["X-Demo-Client-IP"].ToString(), out var forwarded))
            return forwarded.ToString();
        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    public sealed record DemoTokenResponse(string AccessToken, DateTimeOffset ExpiresAt, string[] Scopes);
}
