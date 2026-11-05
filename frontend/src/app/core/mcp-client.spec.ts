import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth';
import { McpClient, McpClientError } from './mcp-client';

describe('McpClient', () => {
  let client: McpClient;
  let requests: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    client = TestBed.inject(McpClient);
    requests = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    requests.verify();
    TestBed.resetTestingModule();
  });

  it('calls only /mcp with the selected tool, scope token and protocol headers', async () => {
    const result = firstValueFrom(client.call('check_inventory', { sku: 'ABC-123' }, 'short-lived-token'));
    const request = requests.expectOne('/mcp');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer short-lived-token');
    expect(request.request.headers.get('MCP-Protocol-Version')).toBe('2025-11-25');
    expect(request.request.headers.get('Accept')).toContain('text/event-stream');
    expect(request.request.body).toMatchObject({
      jsonrpc: '2.0', method: 'tools/call',
      params: { name: 'check_inventory', arguments: { sku: 'ABC-123' } },
    });
    request.flush(JSON.stringify({
      jsonrpc: '2.0', id: 1, result: {
        structuredContent: { status: 'ok', data: { sku: 'ABC-123', availableQuantity: 12 }, error: null, traceId: 'abc' },
      },
    }));
    expect((await result).data).toMatchObject({ availableQuantity: 12 });
  });

  it('reads an SSE response matching the request ID', async () => {
    const result = firstValueFrom(client.call('get_order', { orderId: 1002 }, 'token'));
    requests.expectOne('/mcp').flush([
      'event: message',
      'data: {"jsonrpc":"2.0","id":99,"result":{"structuredContent":{"status":"ok","data":{"id":99}}}}',
      '',
      'event: message',
      'data: {"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"status":"ok","data":{"id":1002},"traceId":"trace"}}}',
      '',
    ].join('\n'));
    expect((await result).data).toMatchObject({ id: 1002 });
  });

  it('does not send a request without a token', async () => {
    await expect(firstValueFrom(client.call('search_customer', { query: 'Alice' }, '')))
      .rejects.toBeInstanceOf(McpClientError);
    requests.expectNone('/mcp');
  });

  it('obtains a short-lived demo token without sending an Authorization header', async () => {
    const result = firstValueFrom(client.requestDemoToken());
    const request = requests.expectOne('/mcp/demo-token');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ accessToken: 'temporary', expiresAt: '2026-11-05T20:00:00Z', scopes: ['customers.read'] });
    expect((await result).accessToken).toBe('temporary');
  });

  it('shows a safe message when demo token issuance is rate limited', async () => {
    const result = firstValueFrom(client.requestDemoToken());
    requests.expectOne('/mcp/demo-token').flush('internal details', { status: 429, statusText: 'Too Many Requests' });
    await expect(result).rejects.toThrow('Limite de tokens atingido.');
  });

  it('shows a safe message for invalid tokens and protocol errors', async () => {
    const unauthorized = firstValueFrom(client.call('search_customer', { query: 'Alice' }, 'secret-token'));
    requests.expectOne('/mcp').flush('private server details', { status: 401, statusText: 'Unauthorized' });
    await expect(unauthorized).rejects.toThrow('Token inválido ou expirado.');

    const denied = firstValueFrom(client.call('get_order', { orderId: 1002 }, 'secret-token'));
    requests.expectOne('/mcp').flush(JSON.stringify({
      jsonrpc: '2.0', id: 2, result: { isError: true, content: [{ text: 'private details' }] },
    }));
    await expect(denied).rejects.toThrow('Confira o escopo do token.');
  });

  it('rejects a response for another request without exposing its content', async () => {
    const response = firstValueFrom(client.call('check_inventory', { sku: 'ABC-123' }, 'secret-token'));
    requests.expectOne('/mcp').flush(JSON.stringify({
      jsonrpc: '2.0', id: 999, result: { structuredContent: { status: 'ok', data: { sku: 'WRONG' } } },
    }));
    await expect(response).rejects.toThrow('A chamada MCP não pôde ser concluída.');
  });
});
