using ModelContextProtocol.AspNetCore;
using ModelContextProtocol.Protocol;

namespace AcmeCommerce.Mcp.Configuration;

public static class McpConfiguration
{
    public static IServiceCollection AddMcpHost(this IServiceCollection services)
    {
        services.AddMcpServer().WithHttpTransport()
            .WithListToolsHandler((_, _) => ValueTask.FromResult(new ListToolsResult { Tools = [] }));
        return services;
    }

    public static WebApplication MapMcpHost(this WebApplication app)
    {
        app.MapMcp("/mcp").RequireAuthorization();
        return app;
    }
}
