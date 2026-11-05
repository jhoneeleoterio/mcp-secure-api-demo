using Microsoft.AspNetCore.Authorization;
using System.Diagnostics;

namespace AcmeCommerce.Mcp.Configuration;

public static class ToolScopes
{
    public const string CustomersRead = "customers.read";
    public const string OrdersRead = "orders.read";
    public const string InventoryRead = "inventory.read";

    public static readonly string[] All = [CustomersRead, OrdersRead, InventoryRead];
}

public sealed record ToolScopeRequirement(string Scope) : IAuthorizationRequirement;

public sealed class ToolScopeHandler(ILogger<ToolScopeHandler> logger) : AuthorizationHandler<ToolScopeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, ToolScopeRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
            return Task.CompletedTask;

        foreach (var claim in context.User.FindAll("scope"))
        {
            if (claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Contains(requirement.Scope, StringComparer.Ordinal))
            {
                context.Succeed(requirement);
                break;
            }
        }

        if (!context.HasSucceeded)
            logger.LogWarning("MCP scope {Scope} denied; trace_id={TraceId}",
                requirement.Scope, Activity.Current?.TraceId.ToString());
        return Task.CompletedTask;
    }
}
