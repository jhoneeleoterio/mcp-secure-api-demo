using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AcmeCommerce.Api.Mapping;

internal sealed class CustomerMapping : IEntityTypeConfiguration<CustomerEntity>
{
    public void Configure(EntityTypeBuilder<CustomerEntity> entity)
    {
        entity.ToTable("customers");
        entity.HasKey(customer => customer.Id);
        entity.Property(customer => customer.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(customer => customer.Name).HasColumnName("name");
        entity.Property(customer => customer.Email).HasColumnName("email");
        entity.HasMany(customer => customer.Orders).WithOne()
            .HasForeignKey(order => order.CustomerId);
    }
}
