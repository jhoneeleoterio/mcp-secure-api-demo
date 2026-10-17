using AcmeCommerce.Mcp.Configuration;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();

builder.Services.AddJwtAuthenticationAndAuthorization(builder.Configuration);
builder.Services.AddMcpHost();

var app = builder.Build();
app.UseJwtAuthenticationAndAuthorization();
app.MapGet("/health/live", () => Results.Ok(new { status = "alive" }));
app.MapMcpHost();
app.Run();
