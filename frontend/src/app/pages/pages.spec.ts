import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CommerceApi } from '../core/commerce-api';
import { DemoOverview, DemoOverviewService } from '../core/demo-overview';
import { HomePage } from './home';
import { CustomersPage } from './customers';
import { OrdersPage } from './orders';
import { InventoryPage } from './inventory';

registerLocaleData(localePt);

const emptyRoute = {
  paramMap: of(convertToParamMap({})),
  queryParamMap: of(convertToParamMap({})),
  snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
};

const overview: DemoOverview = {
  customers: [{ id: 1, name: 'Alice Demo', email: 'alice@example.test', latestOrderId: 1002 }],
  customerWithOrder: {
    id: 1,
    name: 'Alice Demo',
    email: 'alice@example.test',
    latestOrderId: 1002,
  },
  customerWithoutOrder: null,
  order: {
    id: 1002,
    customerId: 1,
    status: 'processing',
    currency: 'BRL',
    items: [{ sku: 'ABC-123', quantity: 2, unitPrice: 150 }],
    total: 300,
  },
  stockedProduct: { sku: 'ABC-123', productName: 'Demo Keyboard', availableQuantity: 12 },
  emptyProduct: { sku: 'XYZ-999', productName: 'Demo Mouse', availableQuantity: 0 },
};

function setup<T>(
  component: Type<T>,
  api: Partial<CommerceApi> = {},
  loadOverview: () => Observable<DemoOverview> = () => of(overview),
) {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: emptyRoute },
      { provide: CommerceApi, useValue: api },
      { provide: DemoOverviewService, useValue: { load: loadOverview } },
    ],
  });
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture;
}

describe('Phase 1 pages', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('explains the demo on the home page', () => {
    const fixture = setup(HomePage);
    expect(fixture.nativeElement.textContent).toContain('Consulte clientes, pedidos e estoque');
    expect(fixture.nativeElement.textContent).toContain('R$');
    expect(fixture.nativeElement.textContent).toContain('12');
  });

  it('does not show fabricated metrics when the overview request fails', () => {
    const fixture = setup(HomePage, {}, () =>
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar os dados');
    expect(fixture.nativeElement.textContent).toContain('Tentar novamente');
    expect(fixture.nativeElement.textContent).not.toContain('Busca por “Demo”');
  });

  it('shows Alice and her latest order', () => {
    const fixture = setup(CustomersPage, {
      customers: () =>
        of([{ id: 1, name: 'Alice Demo', email: 'alice@example.test', latestOrderId: 1002 }]),
    });
    (fixture.componentInstance as CustomersPage).load('Alice');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Alice Demo');
    expect(fixture.nativeElement.textContent).toContain('Ver pedido #1002');
  });

  it('shows a customer without an order and an empty result', () => {
    const fixture = setup(CustomersPage, {
      customers: (query) =>
        of(
          query === 'Bruno'
            ? [{ id: 2, name: 'Bruno Demo', email: 'bruno@example.test', latestOrderId: null }]
            : [],
        ),
    });
    const page = fixture.componentInstance as CustomersPage;
    page.load('Bruno');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sem pedido registrado');
    page.load('unknown');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum cliente encontrado');
  });

  it('shows the order total and SKU', () => {
    const fixture = setup(OrdersPage, {
      order: () =>
        of({
          id: 1002,
          customerId: 1,
          status: 'processing',
          currency: 'BRL',
          items: [{ sku: 'ABC-123', quantity: 2, unitPrice: 150 }],
          total: 300,
        }),
    });
    (fixture.componentInstance as OrdersPage).load(1002);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ABC-123');
    expect(fixture.nativeElement.textContent).toContain('300,00');
  });

  it('distinguishes a missing order from a server failure', () => {
    const fixture = setup(OrdersPage, {
      order: () => throwError(() => new HttpErrorResponse({ status: 404 })),
    });
    (fixture.componentInstance as OrdersPage).load(9999);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pedido não encontrado');
    expect(fixture.nativeElement.textContent).not.toContain('Tentar novamente');
  });

  it('shows stock zero as an existing product', () => {
    const fixture = setup(InventoryPage, {
      inventory: () => of({ sku: 'XYZ-999', productName: 'Demo Mouse', availableQuantity: 0 }),
    });
    (fixture.componentInstance as InventoryPage).load('XYZ-999');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Demo Mouse');
    expect(fixture.nativeElement.textContent).toContain('Sem estoque');
  });

  it('rejects an invalid SKU without calling the API', () => {
    let called = false;
    const fixture = setup(InventoryPage, {
      inventory: () => {
        called = true;
        return of({ sku: 'X', productName: 'X', availableQuantity: 1 });
      },
    });
    const page = fixture.componentInstance as InventoryPage;
    page.skuInput = 'bad sku';
    page.submit();
    fixture.detectChanges();
    expect(called).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Informe um SKU');
  });
});
