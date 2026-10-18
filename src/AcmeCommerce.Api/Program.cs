using AcmeCommerce.Api;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
builder.Services.AddProblemDetails();
var neonUrl = builder.Configuration["Neon:DatabaseUrl"];
var connectionString = string.IsNullOrWhiteSpace(neonUrl)
    ? builder.Configuration.GetConnectionString("AcmeCommerce")
        ?? throw new InvalidOperationException("ConnectionStrings:AcmeCommerce or Neon:DatabaseUrl is required.")
    : NeonConnectionString.FromUrl(neonUrl);
builder.Services.AddDbContext<CommerceDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<CommerceQueries>();

var app = builder.Build();
app.UseExceptionHandler();

app.MapGet("/health/live", () => Results.Ok(new { status = "alive" }));
app.MapGet("/health/ready", async (CommerceDbContext db, CancellationToken ct) =>
{
    try
    {
        await db.Customers.AsNoTracking().CountAsync(ct);
        return Results.Ok(new { status = "ready" });
    }
    catch (NpgsqlException)
    {
        return Results.StatusCode(503);
    }
});

app.MapGet("/customers", async (string? query, CommerceQueries db, CancellationToken ct) =>
{
    var term = query?.Trim();
    if (string.IsNullOrEmpty(term) || term.Length > 100)
        return Results.BadRequest(new { error = "query must contain 1 to 100 characters." });
    return Results.Ok(await db.SearchCustomers(term, ct));
});
app.MapGet("/orders/{id:int}", async (int id, CommerceQueries db, CancellationToken ct) =>
{
    if (id <= 0) return Results.BadRequest(new { error = "id must be positive." });
    var order = await db.GetOrder(id, ct);
    return order is null ? Results.NotFound() : Results.Ok(order);
});
app.MapGet("/inventory/{sku}", async (string sku, CommerceQueries db, CancellationToken ct) =>
{
    if (sku.Length > 64 || sku.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '-'))
        return Results.BadRequest(new { error = "Invalid SKU." });
    var inventory = await db.GetInventory(sku.ToUpperInvariant(), ct);
    return inventory is null ? Results.NotFound() : Results.Ok(inventory);
});
app.Run();
