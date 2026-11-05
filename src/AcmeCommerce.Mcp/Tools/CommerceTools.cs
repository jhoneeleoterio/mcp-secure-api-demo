using System.ComponentModel;
using System.Diagnostics;
using System.Text.RegularExpressions;
using AcmeCommerce.Contracts;
using AcmeCommerce.Mcp.Configuration;
using Microsoft.AspNetCore.Authorization;
using ModelContextProtocol.Server;

namespace AcmeCommerce.Mcp.Tools;

[McpServerToolType]
public sealed class CommerceTools(CommerceApiClient api, ILogger<CommerceTools> logger)
{
    public const string ActivitySourceName = "AcmeCommerce.Mcp.Tools";
    private static readonly ActivitySource Activities = new(ActivitySourceName);
    private static readonly Regex SkuPattern = new(@"\A[A-Za-z0-9-]{1,64}\z", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    [McpServerTool(Name = "search_customer", ReadOnly = true, Idempotent = true, UseStructuredContent = true)]
    [Authorize(Policy = ToolScopes.CustomersRead)]
    [Description("Search up to 20 customers by name, email or exact ID. The latest order ID may be absent.")]
    public Task<ToolResult<IReadOnlyList<Customer>>> SearchCustomer(
        [Description("Search text, 1 to 100 characters after trimming.")] string query,
        CancellationToken cancellationToken)
    {
        var term = query?.Trim();
        return string.IsNullOrEmpty(term) || term.Length > 100
            ? Task.FromResult(Invalid<IReadOnlyList<Customer>>("search_customer", "query must contain 1 to 100 characters."))
            : Run("search_customer", ct => api.SearchCustomers(term, ct), cancellationToken);
    }

    [McpServerTool(Name = "get_order", ReadOnly = true, Idempotent = true, UseStructuredContent = true)]
    [Authorize(Policy = ToolScopes.OrdersRead)]
    [Description("Get an order, its items, status, currency and calculated total.")]
    public Task<ToolResult<Order>> GetOrder(
        [Description("Positive order ID.")] int orderId,
        CancellationToken cancellationToken) =>
        orderId <= 0
            ? Task.FromResult(Invalid<Order>("get_order", "orderId must be positive."))
            : Run("get_order", ct => api.GetOrder(orderId, ct), cancellationToken);

    [McpServerTool(Name = "check_inventory", ReadOnly = true, Idempotent = true, UseStructuredContent = true)]
    [Authorize(Policy = ToolScopes.InventoryRead)]
    [Description("Get product name and available quantity for an SKU. Zero means out of stock.")]
    public Task<ToolResult<Inventory>> CheckInventory(
        [Description("SKU with 1 to 64 ASCII letters, digits or hyphens.")] string sku,
        CancellationToken cancellationToken) =>
        string.IsNullOrEmpty(sku) || !SkuPattern.IsMatch(sku)
            ? Task.FromResult(Invalid<Inventory>("check_inventory", "sku must contain 1 to 64 ASCII letters, digits or hyphens."))
            : Run("check_inventory", ct => api.GetInventory(sku.ToUpperInvariant(), ct), cancellationToken);

    private ToolResult<T> Invalid<T>(string name, string message)
    {
        using var activity = Activities.StartActivity(name);
        activity?.SetTag("mcp.tool.name", name);
        activity?.SetTag("mcp.tool.outcome", "invalid_input");
        var traceId = Activity.Current?.TraceId.ToString();
        logger.LogInformation("MCP tool {Tool} completed with {Outcome} in {ElapsedMs} ms; trace_id={TraceId}",
            name, "invalid_input", 0, traceId);
        return new ToolResult<T>("invalid_input", default, message, traceId);
    }

    private async Task<ToolResult<T>> Run<T>(string name, Func<CancellationToken, Task<ApiLookup<T>>> request, CancellationToken ct)
    {
        using var activity = Activities.StartActivity(name);
        var started = Stopwatch.GetTimestamp();
        string outcome;
        ToolResult<T> result;
        try
        {
            var response = await request(ct);
            outcome = response.Found ? "ok" : "not_found";
            result = new ToolResult<T>(outcome, response.Data,
                response.Found ? null : "Resource not found.", Activity.Current?.TraceId.ToString());
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            outcome = "unavailable";
            result = new ToolResult<T>(outcome, default, "The API timed out.", Activity.Current?.TraceId.ToString());
        }
        catch (HttpRequestException)
        {
            outcome = "unavailable";
            result = new ToolResult<T>(outcome, default, "The API is unavailable.", Activity.Current?.TraceId.ToString());
        }
        finally
        {
            activity?.SetTag("mcp.tool.name", name);
        }

        activity?.SetTag("mcp.tool.outcome", outcome);
        logger.LogInformation("MCP tool {Tool} completed with {Outcome} in {ElapsedMs} ms; trace_id={TraceId}",
            name, outcome, Stopwatch.GetElapsedTime(started).TotalMilliseconds, result.TraceId);
        return result;
    }
}

public sealed record ToolResult<T>(string Status, T? Data, string? Error, string? TraceId);
