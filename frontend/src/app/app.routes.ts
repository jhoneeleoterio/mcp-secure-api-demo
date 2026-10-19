import { Routes } from '@angular/router';
import { HomePage } from './pages/home';
import { CustomersPage } from './pages/customers';
import { OrdersPage } from './pages/orders';
import { InventoryPage } from './pages/inventory';

export const routes: Routes = [
  { path: '', component: HomePage, title: 'Início | AcmeCommerce' },
  { path: 'customers', component: CustomersPage, title: 'Clientes | AcmeCommerce' },
  { path: 'orders', component: OrdersPage, title: 'Pedidos | AcmeCommerce' },
  { path: 'orders/:id', component: OrdersPage, title: 'Pedido | AcmeCommerce' },
  { path: 'inventory', component: InventoryPage, title: 'Estoque | AcmeCommerce' },
  { path: 'inventory/:sku', component: InventoryPage, title: 'Produto | AcmeCommerce' },
  { path: '**', redirectTo: '' },
];
