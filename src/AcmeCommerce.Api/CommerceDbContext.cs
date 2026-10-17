using AcmeCommerce.Api.Mapping;
using Microsoft.EntityFrameworkCore;

namespace AcmeCommerce.Api;

public sealed class CommerceDbContext(DbContextOptions<CommerceDbContext> options) : DbContext(options)
{
    internal DbSet<CustomerEntity> Customers => Set<CustomerEntity>();
    internal DbSet<OrderEntity> Orders => Set<OrderEntity>();
    internal DbSet<ProductEntity> Products => Set<ProductEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new CustomerMapping());
        modelBuilder.ApplyConfiguration(new OrderMapping());
        modelBuilder.ApplyConfiguration(new OrderItemMapping());
        modelBuilder.ApplyConfiguration(new ProductMapping());
    }
}
