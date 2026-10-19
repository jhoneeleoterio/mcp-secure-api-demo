import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CommerceApi } from './commerce-api';

describe('CommerceApi', () => {
  let api: CommerceApi;
  let requests: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(CommerceApi);
    requests = TestBed.inject(HttpTestingController);
  });

  afterEach(() => requests.verify());

  it('uses the existing relative REST endpoints', () => {
    api.customers('Alice').subscribe();
    requests.expectOne('/customers?query=Alice').flush([]);
    api.order(1002).subscribe();
    requests.expectOne('/orders/1002').flush({ id: 1002, items: [] });
    api.inventory('ABC-123').subscribe();
    requests.expectOne('/inventory/ABC-123').flush({ sku: 'ABC-123' });
    api.ready().subscribe();
    requests.expectOne('/health/ready').flush({ status: 'ready' });
  });
});
