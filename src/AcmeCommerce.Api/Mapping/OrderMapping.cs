using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AcmeCommerce.Api.Mapping;

internal sealed class OrderMapping : IEntityTypeConfiguration<OrderEntity>
{
    public void Configure(EntityTypeBuilder<OrderEntity> entity)
    {
        entity.ToTable("orders");
        entity.HasKey(order => order.Id);
        entity.Property(order => order.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(order => order.CustomerId).HasColumnName("customer_id");
        entity.Property(order => order.Status).HasColumnName("status");
        entity.Property(order => order.Currency).HasColumnName("currency")
            .HasColumnType("character(3)");
        entity.Property(order => order.CreatedAt).HasColumnName("created_at");
        entity.HasMany(order => order.Items).WithOne()
            .HasForeignKey(item => item.OrderId);
    }
}
