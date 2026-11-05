using System.Net;
using System.Net.Http.Json;
using System.Diagnostics;
using AcmeCommerce.Contracts;

namespace AcmeCommerce.Mcp.Tools;

public sealed class CommerceApiClient(HttpClient http)
{
    public Task<ApiLookup<IReadOnlyList<Customer>>> SearchCustomers(string query, CancellationToken ct) =>
        Get<IReadOnlyList<Customer>>($"customers?query={Uri.EscapeDataString(query)}", ct);

    public Task<ApiLookup<Order>> GetOrder(int orderId, CancellationToken ct) =>
        Get<Order>($"orders/{orderId}", ct);

    public Task<ApiLookup<Inventory>> GetInventory(string sku, CancellationToken ct) =>
        Get<Inventory>($"inventory/{Uri.EscapeDataString(sku)}", ct);

    private async Task<ApiLookup<T>> Get<T>(string path, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (Activity.Current is { IdFormat: ActivityIdFormat.W3C } activity)
            request.Headers.TryAddWithoutValidation("traceparent", activity.Id);
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return new ApiLookup<T>(false, default);
        response.EnsureSuccessStatusCode();
        var value = await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct);
        if (value is null)
            throw new HttpRequestException("The API returned an empty response.");
        return new ApiLookup<T>(true, value);
    }
}

public sealed record ApiLookup<T>(bool Found, T? Data);
