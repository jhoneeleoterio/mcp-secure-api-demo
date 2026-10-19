import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService, REQUIRES_AUTH, authInterceptor } from './auth';

describe('authInterceptor', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.setAccessToken('test-token');
  });

  afterEach(() => requests.verify());

  it('does not attach a token to public REST calls', () => {
    http.get('/customers?query=Alice').subscribe();
    const request = requests.expectOne('/customers?query=Alice');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });

  it('attaches a token only to an opted-in same-origin call', () => {
    http.get('/future-protected', { context: new HttpContext().set(REQUIRES_AUTH, true) }).subscribe();
    const request = requests.expectOne('/future-protected');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({});
  });

  it('never sends a token to another origin even when opted in', () => {
    http.get('https://example.org/resource', { context: new HttpContext().set(REQUIRES_AUTH, true) }).subscribe();
    const request = requests.expectOne('https://example.org/resource');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
