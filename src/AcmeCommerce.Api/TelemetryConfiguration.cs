using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace AcmeCommerce.Api;

public static class TelemetryConfiguration
{
    public static IServiceCollection AddApiTelemetry(this IServiceCollection services)
    {
        services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService("acmecommerce-api"))
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation(options =>
                    options.Filter = context => !context.Request.Path.StartsWithSegments("/health"))
                .AddConsoleExporter());
        return services;
    }
}
