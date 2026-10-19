using System.Text.Json.Nodes;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace AcmeCommerce.Api;

public sealed record HealthResponse(string Status);
public sealed record ApiError(string Error);

public sealed class ApiExamplesOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        switch (context.ApiDescription.RelativePath)
        {
            case "health/live":
                Example(operation, "200", """{"status":"alive"}""");
                break;
            case "health/ready":
                Example(operation, "200", """{"status":"ready"}""");
                break;
            case "customers":
                Parameter(operation, "query", "Nome, e-mail ou ID exato do cliente.", "Alice", required: true);
                Example(operation, "200", """[{"id":1,"name":"Alice Demo","email":"alice@example.test","latestOrderId":1002}]""");
                Example(operation, "400", """{"error":"query must contain 1 to 100 characters."}""");
                break;
            case "orders/{id:int}":
                Parameter(operation, "id", "ID numérico positivo do pedido.", 1002);
                Example(operation, "200", """{"id":1002,"customerId":1,"status":"processing","currency":"BRL","items":[{"sku":"ABC-123","quantity":2,"unitPrice":150.00}],"total":300.00}""");
                Example(operation, "400", """{"error":"id must be positive."}""");
                break;
            case "inventory/{sku}":
                Parameter(operation, "sku", "Código do produto, por exemplo ABC-123.", "ABC-123");
                Example(operation, "200", """{"sku":"ABC-123","productName":"Demo Keyboard","availableQuantity":12}""");
                Example(operation, "400", """{"error":"Invalid SKU."}""");
                break;
        }
    }

    private static void Parameter(OpenApiOperation operation, string name, string description, string value,
        bool required = false)
    {
        if (operation.Parameters?.FirstOrDefault(item => item.Name == name) is not OpenApiParameter parameter)
            return;
        parameter.Description = description;
        parameter.Example = JsonValue.Create(value);
        parameter.Required = required;
    }

    private static void Parameter(OpenApiOperation operation, string name, string description, int value)
    {
        if (operation.Parameters?.FirstOrDefault(item => item.Name == name) is not OpenApiParameter parameter)
            return;
        parameter.Description = description;
        parameter.Example = JsonValue.Create(value);
    }

    private static void Example(OpenApiOperation operation, string status, string json)
    {
        if (operation.Responses?.TryGetValue(status, out var response) == true
            && response?.Content?.TryGetValue("application/json", out var content) == true
            && content is OpenApiMediaType media)
            media.Example = JsonNode.Parse(json);
    }
}
