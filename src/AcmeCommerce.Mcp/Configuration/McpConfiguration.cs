using ModelContextProtocol.AspNetCore;
using AcmeCommerce.Mcp.Tools;
using Microsoft.AspNetCore.RateLimiting;

namespace AcmeCommerce.Mcp.Configuration;

public static class McpConfiguration
{
    public static IServiceCollection AddMcpHost(this IServiceCollection services, IConfiguration configuration)
    {
        var apiBaseUrl = configuration["Api:BaseUrl"] ?? "http://api:8080/";
        if (!Uri.TryCreate(apiBaseUrl, UriKind.Absolute, out var apiUri)
            || (apiUri.Scheme != Uri.UriSchemeHttp && apiUri.Scheme != Uri.UriSchemeHttps)
            || !apiUri.AbsolutePath.EndsWith('/'))
            throw new InvalidOperationException("Api:BaseUrl must be an absolute HTTP URL ending in '/'.");
        services.AddHttpClient<CommerceApiClient>(client =>
        {
            client.BaseAddress = apiUri;
            client.Timeout = TimeSpan.FromSeconds(5);
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        services.AddMcpServer().WithHttpTransport().AddAuthorizationFilters()
            .WithTools<CommerceTools>();
        return services;
    }

    public static WebApplication MapMcpHost(this WebApplication app)
    {
        app.MapMcp("/mcp").RequireAuthorization().RequireRateLimiting("mcp-calls");
        return app;
    }
}
