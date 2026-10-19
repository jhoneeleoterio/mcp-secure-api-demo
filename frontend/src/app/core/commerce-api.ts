import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface Customer {
  id: number;
  name: string;
  email: string;
  latestOrderId: number | null;
}

export interface OrderItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: number;
  customerId: number;
  status: string;
  currency: string;
  items: OrderItem[];
  total: number;
}

export interface Inventory {
  sku: string;
  productName: string;
  availableQuantity: number;
}

export function orderStatusLabel(status: string): string {
  return (
    ({ processing: 'Em processamento', shipped: 'Enviado' } as Record<string, string>)[status] ??
    status
  );
}

@Injectable({ providedIn: 'root' })
export class CommerceApi {
  private readonly http = inject(HttpClient);

  ready() {
    return this.http.get<{ status: string }>('/health/ready');
  }
  customers(query: string) {
    return this.http.get<Customer[]>('/customers', { params: { query } });
  }
  order(id: number) {
    return this.http.get<Order>(`/orders/${id}`);
  }
  inventory(sku: string) {
    return this.http.get<Inventory>(`/inventory/${encodeURIComponent(sku)}`);
  }
}
