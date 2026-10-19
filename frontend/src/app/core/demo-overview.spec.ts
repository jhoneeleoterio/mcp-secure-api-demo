import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DemoOverview, DemoOverviewService } from './demo-overview';

describe('DemoOverviewService', () => {
  it('loads the home metrics from the existing REST endpoints', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(DemoOverviewService);
    const http = TestBed.inject(HttpTestingController);
    let result: DemoOverview | undefined;

    service.load().subscribe((value) => {
      result = value;
    });
    http.expectOne('/customers?query=Demo').flush([
      { id: 1, name: 'Alice Demo', email: 'alice@example.test', latestOrderId: 1002 },
      { id: 2, name: 'Bruno Demo', email: 'bruno@example.test', latestOrderId: null },
    ]);
    http.expectOne('/orders/1002').flush({
      id: 1002,
      customerId: 1,
      status: 'processing',
      currency: 'BRL',
      items: [{ sku: 'ABC-123', quantity: 2, unitPrice: 150 }],
      total: 300,
    });
    http
      .expectOne('/inventory/ABC-123')
      .flush({ sku: 'ABC-123', productName: 'Demo Keyboard', availableQuantity: 12 });
    http
      .expectOne('/inventory/XYZ-999')
      .flush({ sku: 'XYZ-999', productName: 'Demo Mouse', availableQuantity: 0 });

    expect(result!.customers).toHaveLength(2);
    expect(result!.customerWithOrder?.name).toBe('Alice Demo');
    expect(result!.customerWithoutOrder?.name).toBe('Bruno Demo');
    expect(result!.order.total).toBe(300);
    expect(result!.emptyProduct.availableQuantity).toBe(0);
    http.verify();
  });
});
