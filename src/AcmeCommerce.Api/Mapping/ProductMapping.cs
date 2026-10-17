using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AcmeCommerce.Api.Mapping;

internal sealed class ProductMapping : IEntityTypeConfiguration<ProductEntity>
{
    public void Configure(EntityTypeBuilder<ProductEntity> entity)
    {
        entity.ToTable("products");
        entity.HasKey(product => product.Sku);
        entity.Property(product => product.Sku).HasColumnName("sku");
        entity.Property(product => product.Name).HasColumnName("name");
        entity.Property(product => product.AvailableQuantity).HasColumnName("available_quantity");
    }
}
