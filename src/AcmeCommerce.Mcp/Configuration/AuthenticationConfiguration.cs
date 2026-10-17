using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace AcmeCommerce.Mcp.Configuration;

public static class AuthenticationConfiguration
{
    public static IServiceCollection AddJwtAuthenticationAndAuthorization(
        this IServiceCollection services, IConfiguration configuration)
    {
        var issuer = RequiredSetting(configuration, "Jwt:Issuer");
        var audience = RequiredSetting(configuration, "Jwt:Audience");
        var signingKey = Convert.FromBase64String(RequiredSetting(configuration, "Jwt:SigningKeyBase64"));
        if (signingKey.Length < 32)
            throw new InvalidOperationException("Jwt:SigningKeyBase64 must contain at least 32 random bytes.");

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = issuer,
                    ValidateAudience = true,
                    ValidAudience = audience,
                    ValidateLifetime = true,
                    RequireExpirationTime = true,
                    ClockSkew = TimeSpan.Zero,
                    RequireSignedTokens = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(signingKey),
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    NameClaimType = "sub"
                };
            });
        services.AddAuthorization();
        return services;
    }

    public static WebApplication UseJwtAuthenticationAndAuthorization(this WebApplication app)
    {
        app.UseAuthentication();
        app.UseAuthorization();
        return app;
    }

    private static string RequiredSetting(IConfiguration configuration, string name) =>
        configuration[name] is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"{name} is required.");
}
