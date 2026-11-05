using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using AcmeCommerce.Mcp.Configuration;
using AcmeCommerce.Mcp.Tools;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using ModelContextProtocol.AspNetCore;
using ModelContextProtocol.Server;
using Xunit;

namespace AcmeCommerce.Mcp.Tests;

public sealed class ToolAuthorizationTests
{
    private static readonly byte[] TestKey = Enumerable.Range(1, 32).Select(value => (byte)value).ToArray();

    [Theory]
    [InlineData(ToolScopes.CustomersRead, "customers.read", true)]
    [InlineData(ToolScopes.OrdersRead, "orders.read", true)]
    [InlineData(ToolScopes.InventoryRead, "inventory.read", true)]
    [InlineData(ToolScopes.CustomersRead, "orders.read", false)]
    [InlineData(ToolScopes.CustomersRead, "customers.read.extra", false)]
    [InlineData(ToolScopes.CustomersRead, "inventory.read customers.read", true)]
    public async Task Policy_requires_exact_scope(string policy, string claim, bool permitted)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddJwtAuthenticationAndAuthorization(TestConfiguration());
        using var provider = services.BuildServiceProvider();
        var authorization = provider.GetRequiredService<IAuthorizationService>();
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim("scope", claim)], "Bearer"));

        var result = await authorization.AuthorizeAsync(user, policy);

        Assert.Equal(permitted, result.Succeeded);
    }

    [Fact]
    public async Task Mcp_filters_tools_and_denies_calls_before_http()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        foreach (var setting in TestConfiguration().AsEnumerable())
            builder.Configuration[setting.Key] = setting.Value;

        builder.Services.AddJwtAuthenticationAndAuthorization(builder.Configuration);
        builder.Services.AddSingleton<SpyHttpHandler>();
        builder.Services.AddSingleton(provider => new HttpClient(provider.GetRequiredService<SpyHttpHandler>())
        {
            BaseAddress = new Uri("https://downstream.invalid/")
        });
        builder.Services.AddMcpServer().WithHttpTransport().AddAuthorizationFilters()
            .WithTools<ProbeTool>();

        await using var app = builder.Build();
        app.UseJwtAuthenticationAndAuthorization();
        app.MapMcp("/mcp").RequireAuthorization();
        await app.StartAsync();

        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var spy = app.Services.GetRequiredService<SpyHttpHandler>();
        var withoutScope = Token();
        var wrongScope = Token("orders.read");
        var permitted = Token("customers.read");

        Assert.Equal(HttpStatusCode.Unauthorized, (await Post(client, InitializeRequest(), null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post(client, InitializeRequest(), "invalid")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await Post(client, InitializeRequest(), Token(expires: DateTime.UtcNow.AddMinutes(-1)))).StatusCode);

        using (var list = await McpResponse(await Post(client, ListRequest(), withoutScope)))
            Assert.Empty(list.RootElement.GetProperty("result").GetProperty("tools").EnumerateArray());
        using (var list = await McpResponse(await Post(client, ListRequest(), wrongScope)))
            Assert.Empty(list.RootElement.GetProperty("result").GetProperty("tools").EnumerateArray());

        await AssertDenied(await Post(client, CallRequest(), withoutScope));
        await AssertDenied(await Post(client, CallRequest(), wrongScope));
        Assert.Equal(0, spy.Calls);

        using (var list = await McpResponse(await Post(client, ListRequest(), permitted)))
        {
            var tools = list.RootElement.GetProperty("result").GetProperty("tools");
            Assert.Equal("probe", Assert.Single(tools.EnumerateArray()).GetProperty("name").GetString());
        }
        using (var result = await McpResponse(await Post(client, CallRequest(), permitted)))
            Assert.True(result.RootElement.TryGetProperty("result", out _));
        Assert.Equal(1, spy.Calls);
    }

    [Fact]
    public async Task Production_host_exposes_only_scoped_tools_and_calls_api()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        foreach (var setting in TestConfiguration().AsEnumerable())
            builder.Configuration[setting.Key] = setting.Value;
        builder.Services.AddJwtAuthenticationAndAuthorization(builder.Configuration);
        builder.Services.AddMcpTelemetry();
        builder.Services.AddMcpHost(builder.Configuration);
        builder.Services.AddSingleton<SpyHttpHandler>();
        builder.Services.AddHttpClient<CommerceApiClient>()
            .ConfigurePrimaryHttpMessageHandler(provider => provider.GetRequiredService<SpyHttpHandler>());

        await using var app = builder.Build();
        app.UseJwtAuthenticationAndAuthorization();
        app.MapMcpHost();
        await app.StartAsync();

        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var spy = app.Services.GetRequiredService<SpyHttpHandler>();
        using (var list = await McpResponse(await Post(client, ListRequest(), Token("customers.read"))))
            Assert.Equal("search_customer", Assert.Single(list.RootElement.GetProperty("result").GetProperty("tools").EnumerateArray()).GetProperty("name").GetString());
        using (var list = await McpResponse(await Post(client, ListRequest(), Token("orders.read inventory.read"))))
            Assert.Equal(2, list.RootElement.GetProperty("result").GetProperty("tools").GetArrayLength());

        await AssertDenied(await Post(client, CallRequest("get_order", new { orderId = 1002 }), Token("customers.read")));
        Assert.Equal(0, spy.Calls);

        using (var result = await McpResponse(await Post(client, CallRequest("search_customer", new { query = "Alice" }), Token("customers.read"))))
            Assert.Equal("ok", result.RootElement.GetProperty("result").GetProperty("structuredContent").GetProperty("status").GetString());
        using (var result = await McpResponse(await Post(client, CallRequest("get_order", new { orderId = 1002 }), Token("orders.read"))))
            Assert.Equal(1002, result.RootElement.GetProperty("result").GetProperty("structuredContent").GetProperty("data").GetProperty("id").GetInt32());
        using (var result = await McpResponse(await Post(client, CallRequest("check_inventory", new { sku = "ABC-123" }), Token("inventory.read"))))
            Assert.Equal(12, result.RootElement.GetProperty("result").GetProperty("structuredContent").GetProperty("data").GetProperty("availableQuantity").GetInt32());
        Assert.Equal(3, spy.Calls);

        using (var result = await McpResponse(await Post(client, CallRequest("check_inventory", new { sku = "bad/sku" }), Token("inventory.read"))))
            Assert.Equal("invalid_input", result.RootElement.GetProperty("result").GetProperty("structuredContent").GetProperty("status").GetString());
        using (var result = await McpResponse(await Post(client, CallRequest("check_inventory", new { sku = "ABC-123\n" }), Token("inventory.read"))))
            Assert.Equal("invalid_input", result.RootElement.GetProperty("result").GetProperty("structuredContent").GetProperty("status").GetString());
        Assert.Equal(3, spy.Calls);

        using (var result = await McpResponse(await Post(client, CallRequest("get_order", new { orderId = 9999 }), Token("orders.read"))))
            Assert.Equal("not_found", result.RootElement.GetProperty("result").GetProperty("structuredContent").GetProperty("status").GetString());
        using (var result = await McpResponse(await Post(client, CallRequest("check_inventory", new { sku = "TIMEOUT" }), Token("inventory.read"))))
            Assert.Equal("unavailable", result.RootElement.GetProperty("result").GetProperty("structuredContent").GetProperty("status").GetString());
        using (var result = await McpResponse(await Post(client, CallRequest("check_inventory", new { sku = "FAIL" }), Token("inventory.read"))))
            Assert.Equal("unavailable", result.RootElement.GetProperty("result").GetProperty("structuredContent").GetProperty("status").GetString());
        using (var result = await McpResponse(await Post(client, CallRequest("check_inventory", new { sku = "REDIRECT" }), Token("inventory.read"))))
            Assert.Equal("unavailable", result.RootElement.GetProperty("result").GetProperty("structuredContent").GetProperty("status").GetString());
        Assert.Equal(7, spy.Calls);
    }

    [Fact]
    public async Task HttpClient_propagates_trace_to_real_api_without_manual_header()
    {
        var receivedTrace = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var apiBuilder = WebApplication.CreateBuilder();
        apiBuilder.WebHost.UseUrls("http://127.0.0.1:0");
        apiBuilder.Logging.ClearProviders();
        await using var api = apiBuilder.Build();
        api.MapGet("/inventory/ABC-123", (HttpContext context) =>
        {
            receivedTrace.TrySetResult(context.Request.Headers["traceparent"].ToString());
            return Results.Json(new { sku = "ABC-123", productName = "Sample", availableQuantity = 12 });
        });
        await api.StartAsync();

        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        foreach (var setting in TestConfiguration().AsEnumerable())
            builder.Configuration[setting.Key] = setting.Value;
        builder.Configuration["Api:BaseUrl"] = api.Urls.Single() + "/";
        builder.Services.AddJwtAuthenticationAndAuthorization(builder.Configuration);
        builder.Services.AddMcpTelemetry();
        builder.Services.AddMcpHost(builder.Configuration);

        await using var mcp = builder.Build();
        mcp.UseJwtAuthenticationAndAuthorization();
        mcp.MapMcpHost();
        await mcp.StartAsync();

        using var client = new HttpClient { BaseAddress = new Uri(mcp.Urls.Single()) };
        using var result = await McpResponse(await Post(client,
            CallRequest("check_inventory", new { sku = "ABC-123" }), Token("inventory.read")));
        var toolTraceId = result.RootElement.GetProperty("result").GetProperty("structuredContent")
            .GetProperty("traceId").GetString();
        var traceparent = await receivedTrace.Task.WaitAsync(TimeSpan.FromSeconds(5));

        Assert.NotNull(traceparent);
        Assert.Equal(toolTraceId, traceparent.Split('-')[1]);
    }

    private static IConfiguration TestConfiguration() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Issuer"] = "test-issuer",
            ["Jwt:Audience"] = "test-audience",
            ["Jwt:SigningKeyBase64"] = Convert.ToBase64String(TestKey)
        }).Build();

    private static string Token(string? scope = null, DateTime? expires = null)
    {
        var claims = new List<Claim> { new("sub", "test-caller") };
        if (scope is not null) claims.Add(new Claim("scope", scope));
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: "test-issuer",
            audience: "test-audience",
            claims: claims,
            notBefore: now.AddMinutes(-10),
            expires: expires ?? now.AddMinutes(10),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(TestKey), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static object InitializeRequest() => new
    {
        jsonrpc = "2.0",
        id = 1,
        method = "initialize",
        @params = new
        {
            protocolVersion = "2025-11-25",
            capabilities = new { },
            clientInfo = new { name = "scope-test", version = "1.0" }
        }
    };

    private static object ListRequest() => new { jsonrpc = "2.0", id = 2, method = "tools/list" };
    private static object CallRequest(string name = "probe", object? arguments = null) => new
    {
        jsonrpc = "2.0", id = 3, method = "tools/call", @params = new { name, arguments = arguments ?? new { } }
    };

    private static async Task<HttpResponseMessage> Post(HttpClient client, object payload, string? token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/mcp")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));
        request.Headers.Add("MCP-Protocol-Version", "2025-11-25");
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request);
    }

    private static async Task<JsonDocument> McpResponse(HttpResponseMessage response)
    {
        using (response)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            if (body.TrimStart().StartsWith('{')) return JsonDocument.Parse(body);
            var data = body.Split('\n').LastOrDefault(line => line.StartsWith("data:", StringComparison.Ordinal));
            Assert.NotNull(data);
            return JsonDocument.Parse(data[5..].Trim());
        }
    }

    private static async Task AssertDenied(HttpResponseMessage response)
    {
        if (response.StatusCode != HttpStatusCode.OK)
        {
            using (response) Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            return;
        }
        using var message = await McpResponse(response);
        Assert.True(message.RootElement.TryGetProperty("error", out _)
            || message.RootElement.GetProperty("result").GetProperty("isError").GetBoolean());
    }

    [McpServerToolType]
    public sealed class ProbeTool(HttpClient client)
    {
        [McpServerTool(Name = "probe")]
        [Authorize(Policy = ToolScopes.CustomersRead)]
        public Task<string> Probe(CancellationToken cancellationToken) =>
            client.GetStringAsync("probe", cancellationToken);
    }

    public sealed class SpyHttpHandler : HttpMessageHandler
    {
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            var path = request.RequestUri?.AbsolutePath;
            if (path == "/orders/9999")
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
            if (path == "/inventory/TIMEOUT")
                return Task.FromCanceled<HttpResponseMessage>(new CancellationToken(true));
            if (path == "/inventory/FAIL")
                throw new HttpRequestException("private downstream details");
            if (path == "/inventory/REDIRECT")
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
                {
                    Headers = { Location = new Uri("http://169.254.169.254/latest/meta-data/") }
                });
            var content = path switch
            {
                "/customers" => "[{\"id\":1,\"name\":\"Alice\",\"email\":\"alice@example.test\",\"latestOrderId\":1002}]",
                "/orders/1002" => "{\"id\":1002,\"customerId\":1,\"status\":\"paid\",\"currency\":\"BRL\",\"items\":[{\"sku\":\"ABC-123\",\"quantity\":1,\"unitPrice\":300}]}",
                "/inventory/ABC-123" => "{\"sku\":\"ABC-123\",\"productName\":\"Sample\",\"availableQuantity\":12}",
                _ => "downstream-ok"
            };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(content, Encoding.UTF8, "application/json")
            });
        }
    }
}
