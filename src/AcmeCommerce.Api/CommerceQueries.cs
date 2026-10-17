using System.Globalization;
using AcmeCommerce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace AcmeCommerce.Api;

public sealed class CommerceQueries(CommerceDbContext db)
{
    public async Task<IReadOnlyList<Customer>> SearchCustomers(string query, CancellationToken ct)
    {
        var pattern = $"%{query.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
        var exactId = int.TryParse(query, NumberStyles.None, CultureInfo.InvariantCulture, out var id)
            && id.ToString(CultureInfo.InvariantCulture) == query ? id : (int?)null;

        return await db.Customers.AsNoTracking()
            .Where(customer => EF.Functions.ILike(customer.Name, pattern, "\\")
                || EF.Functions.ILike(customer.Email, pattern, "\\")
                || (exactId.HasValue && customer.Id == exactId.Value))
            .OrderBy(customer => customer.Id)
            .Take(20)
            .Select(customer => new Customer(customer.Id, customer.Name, customer.Email,
                customer.Orders.OrderByDescending(order => order.CreatedAt)
                    .ThenByDescending(order => order.Id)
                    .Select(order => (int?)order.Id).FirstOrDefault()))
            .ToListAsync(ct);
    }

    public async Task<Order?> GetOrder(int id, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().Include(entity => entity.Items)
            .SingleOrDefaultAsync(entity => entity.Id == id, ct);
        if (order is null) return null;

        return new Order(order.Id, order.CustomerId, order.Status, order.Currency,
            order.Items.OrderBy(item => item.Sku)
                .Select(item => new OrderItem(item.Sku, item.Quantity, item.UnitPrice)).ToList());
    }

    public async Task<Inventory?> GetInventory(string sku, CancellationToken ct)
    {
        return await db.Products.AsNoTracking().Where(product => product.Sku == sku)
            .Select(product => new Inventory(product.Sku, product.Name, product.AvailableQuantity))
            .SingleOrDefaultAsync(ct);
    }
}
