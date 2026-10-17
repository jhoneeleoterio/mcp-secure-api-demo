namespace AcmeCommerce.Contracts;

public sealed record Customer(int Id, string Name, string Email, int? LatestOrderId);
public sealed record OrderItem(string Sku, int Quantity, decimal UnitPrice);
public sealed record Order(int Id, int CustomerId, string Status, string Currency,
    IReadOnlyList<OrderItem> Items)
{
    public decimal Total => Items.Sum(item => item.Quantity * item.UnitPrice);
}
public sealed record Inventory(string Sku, string ProductName, int AvailableQuantity);
