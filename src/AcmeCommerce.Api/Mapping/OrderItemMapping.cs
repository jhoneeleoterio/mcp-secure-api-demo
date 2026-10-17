using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AcmeCommerce.Api.Mapping;

internal sealed class OrderItemMapping : IEntityTypeConfiguration<OrderItemEntity>
{
    public void Configure(EntityTypeBuilder<OrderItemEntity> entity)
    {
        entity.ToTable("order_items");
        entity.HasKey(item => new { item.OrderId, item.Sku });
        entity.Property(item => item.OrderId).HasColumnName("order_id");
        entity.Property(item => item.Sku).HasColumnName("sku");
        entity.Property(item => item.Quantity).HasColumnName("quantity");
        entity.Property(item => item.UnitPrice).HasColumnName("unit_price")
            .HasPrecision(12, 2);
    }
}
