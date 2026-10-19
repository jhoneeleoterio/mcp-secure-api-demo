using AcmeCommerce.Api;
using AcmeCommerce.Contracts;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "AcmeCommerce API",
        Version = "v1",
        Description = "API REST de consulta a clientes, pedidos e estoque fictícios. Não exige autenticação."
    });
    options.OperationFilter<ApiExamplesOperationFilter>();
});
var neonUrl = builder.Configuration["Neon:DatabaseUrl"];
var connectionString = string.IsNullOrWhiteSpace(neonUrl)
    ? builder.Configuration.GetConnectionString("AcmeCommerce")
        ?? throw new InvalidOperationException("ConnectionStrings:AcmeCommerce or Neon:DatabaseUrl is required.")
    : NeonConnectionString.FromUrl(neonUrl);
builder.Services.AddDbContext<CommerceDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<CommerceQueries>();

var app = builder.Build();
app.UseExceptionHandler();
app.UseSwagger();
app.UseReDoc(options =>
{
    options.RoutePrefix = "docs";
    options.SpecUrl = "/swagger/v1/swagger.json";
    options.DocumentTitle = "AcmeCommerce API";
    options.IndexStream = () => typeof(ApiExamplesOperationFilter).Assembly
        .GetManifestResourceStream("AcmeCommerce.Api.ReDocIndex.html")!;
});

app.MapGet("/health/live", () => Results.Ok(new { status = "alive" }))
    .WithTags("Saúde")
    .WithSummary("Verifica se o processo da API está ativo")
    .WithDescription("Retorna 200 quando a aplicação está executando. Não consulta o banco de dados.")
    .Produces<HealthResponse>();
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
})
    .WithTags("Saúde")
    .WithSummary("Verifica se a API consegue acessar o banco")
    .WithDescription("Retorna 200 quando o PostgreSQL responde ou 503 quando a conexão falha.")
    .Produces<HealthResponse>()
    .Produces(StatusCodes.Status503ServiceUnavailable);

app.MapGet("/customers", async (string? query, CommerceQueries db, CancellationToken ct) =>
{
    var term = query?.Trim();
    if (string.IsNullOrEmpty(term) || term.Length > 100)
        return Results.BadRequest(new { error = "query must contain 1 to 100 characters." });
    return Results.Ok(await db.SearchCustomers(term, ct));
})
    .WithTags("Clientes")
    .WithSummary("Busca clientes")
    .WithDescription("Busca por trecho do nome ou e-mail, sem diferenciar maiúsculas, ou por ID exato. A consulta deve ter de 1 a 100 caracteres. Retorna no máximo 20 clientes, ordenados por ID; o pedido mais recente pode ser nulo.")
    .Produces<IReadOnlyList<Customer>>()
    .Produces<ApiError>(StatusCodes.Status400BadRequest);
app.MapGet("/orders/{id:int}", async (int id, CommerceQueries db, CancellationToken ct) =>
{
    if (id <= 0) return Results.BadRequest(new { error = "id must be positive." });
    var order = await db.GetOrder(id, ct);
    return order is null ? Results.NotFound() : Results.Ok(order);
})
    .WithTags("Pedidos")
    .WithSummary("Consulta um pedido")
    .WithDescription("Retorna o pedido, seus itens e o total calculado pela soma de quantidade × preço unitário.")
    .Produces<Order>()
    .Produces<ApiError>(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status404NotFound);
app.MapGet("/inventory/{sku}", async (string sku, CommerceQueries db, CancellationToken ct) =>
{
    if (sku.Length > 64 || sku.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '-'))
        return Results.BadRequest(new { error = "Invalid SKU." });
    var inventory = await db.GetInventory(sku.ToUpperInvariant(), ct);
    return inventory is null ? Results.NotFound() : Results.Ok(inventory);
})
    .WithTags("Estoque")
    .WithSummary("Consulta o estoque de um produto")
    .WithDescription("Aceita SKU com letras, números e hífen, até 64 caracteres. A busca ignora maiúsculas e minúsculas. Quantidade zero significa produto existente sem unidades disponíveis.")
    .Produces<Inventory>()
    .Produces<ApiError>(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status404NotFound);
app.Run();
