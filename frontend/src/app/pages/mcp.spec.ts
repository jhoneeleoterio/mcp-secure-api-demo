import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { McpClient } from '../core/mcp-client';
import { McpExampleCard } from '../ui/mcp-example-card';
import { McpPage } from './mcp';

describe('MCP examples page', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('executes an example and clears the result when the token is removed', () => {
    const calls: unknown[] = [];
    TestBed.configureTestingModule({
      imports: [McpPage],
      providers: [{ provide: McpClient, useValue: {
        call: (name: string, args: object, token: string) => {
          calls.push({ name, args, token });
          return of({ status: 'ok', data: [{ name: 'Alice Demo' }], error: null, traceId: 'trace-123' });
        },
      } }],
    });
    const fixture = TestBed.createComponent(McpPage);
    fixture.componentInstance.token.set('temporary-token');
    fixture.detectChanges();
    const cards = fixture.debugElement.queryAll(By.directive(McpExampleCard));
    expect(cards.length).toBe(3);
    const first = cards[0].componentInstance as McpExampleCard;
    first.run();
    fixture.detectChanges();
    expect(calls).toEqual([{ name: 'search_customer', args: { query: 'Alice' }, token: 'temporary-token' }]);
    expect(cards[0].nativeElement.textContent).toContain('Alice Demo');

    fixture.componentInstance.clearToken();
    fixture.detectChanges();
    expect(cards[0].nativeElement.textContent).not.toContain('Alice Demo');
    expect((fixture.nativeElement.querySelector('#mcp-token') as HTMLInputElement).value).toBe('');
  });

  it('rejects an invalid order ID before calling MCP', () => {
    let called = false;
    TestBed.configureTestingModule({
      imports: [McpPage],
      providers: [{ provide: McpClient, useValue: { call: () => { called = true; return of(null); } } }],
    });
    const fixture = TestBed.createComponent(McpPage);
    fixture.componentInstance.token.set('temporary-token');
    fixture.detectChanges();
    const order = fixture.debugElement.queryAll(By.directive(McpExampleCard))[1].componentInstance as McpExampleCard;
    order.inputValue = '0';
    order.run();
    fixture.detectChanges();
    expect(called).toBe(false);
    expect(order.error()).toContain('ID de pedido positivo');
  });

  it('activates a public demo token in memory for all three examples', () => {
    TestBed.configureTestingModule({
      imports: [McpPage],
      providers: [{ provide: McpClient, useValue: {
        requestDemoToken: () => of({ accessToken: 'demo-jwt', expiresAt: '2026-11-05T20:00:00Z', scopes: [] }),
        call: () => of({ status: 'ok', data: [], error: null, traceId: null }),
      } }],
    });
    const fixture = TestBed.createComponent(McpPage);
    fixture.detectChanges();
    fixture.componentInstance.activateDemo();
    fixture.detectChanges();
    expect(fixture.componentInstance.token()).toBe('demo-jwt');
    expect(fixture.nativeElement.textContent).toContain('Token temporário ativo');
    const buttons = fixture.debugElement.queryAll(By.directive(McpExampleCard))
      .map((card) => card.nativeElement.querySelector('button') as HTMLButtonElement);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
  });
});
