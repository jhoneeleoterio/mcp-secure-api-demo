using AcmeCommerce.Mcp.Tools;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace AcmeCommerce.Mcp.Configuration;

public static class TelemetryConfiguration
{
    public static IServiceCollection AddMcpTelemetry(this IServiceCollection services)
    {
        services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService("acmecommerce-mcp"))
            .WithTracing(tracing => tracing
                .AddSource(CommerceTools.ActivitySourceName)
                .AddAspNetCoreInstrumentation(options =>
                    options.Filter = context => !context.Request.Path.StartsWithSegments("/health"))
                .AddHttpClientInstrumentation()
                .AddConsoleExporter());
        return services;
    }
}
