using AcmeCommerce.Mcp.Configuration;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 16 * 1024);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
builder.Services.AddMcpTelemetry();

builder.Services.AddJwtAuthenticationAndAuthorization(builder.Configuration);
builder.Services.AddMcpDemoTokens(builder.Configuration);
builder.Services.AddMcpHost(builder.Configuration);

var app = builder.Build();
app.UseRouting();
app.UseJwtAuthenticationAndAuthorization();
app.UseMcpDemoOriginCheck();
app.UseRateLimiter();
app.MapGet("/health/live", () => Results.Ok(new { status = "alive" }));
app.MapMcpDemoTokens();
app.MapMcpHost();
app.Run();
