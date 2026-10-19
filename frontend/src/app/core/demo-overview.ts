import { Injectable, inject } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { CommerceApi, Customer, Inventory, Order } from './commerce-api';

export interface DemoOverview {
  customers: Customer[];
  customerWithOrder: Customer | null;
  customerWithoutOrder: Customer | null;
  order: Order;
  stockedProduct: Inventory;
  emptyProduct: Inventory;
}

/** Reads the documented demo records through the same REST endpoints as the detail pages. */
@Injectable({ providedIn: 'root' })
export class DemoOverviewService {
  private readonly api = inject(CommerceApi);

  load() {
    return forkJoin({
      customers: this.api.customers('Demo'),
      order: this.api.order(1002),
      stockedProduct: this.api.inventory('ABC-123'),
      emptyProduct: this.api.inventory('XYZ-999'),
    }).pipe(
      map(({ customers, order, stockedProduct, emptyProduct }): DemoOverview => ({
        customers,
        customerWithOrder:
          customers.find((customer) => customer.latestOrderId === order.id) ?? null,
        customerWithoutOrder: customers.find((customer) => customer.latestOrderId === null) ?? null,
        order,
        stockedProduct,
        emptyProduct,
      })),
    );
  }
}
