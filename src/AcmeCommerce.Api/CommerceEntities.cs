namespace AcmeCommerce.Api;

internal sealed class CustomerEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public List<OrderEntity> Orders { get; set; } = [];
}

internal sealed class OrderEntity
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public string Status { get; set; } = "";
    public string Currency { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public List<OrderItemEntity> Items { get; set; } = [];
}

internal sealed class OrderItemEntity
{
    public int OrderId { get; set; }
    public string Sku { get; set; } = "";
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}

internal sealed class ProductEntity
{
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public int AvailableQuantity { get; set; }
}
