import { JsonPipe } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { McpClient, McpClientError, McpToolName, McpToolResult } from '../core/mcp-client';
import { AppButton } from './button';

export interface McpExample {
  name: McpToolName;
  title: string;
  description: string;
  scope: string;
  inputLabel: string;
  initialValue: string;
}

@Component({
  selector: 'app-mcp-example-card',
  imports: [FormsModule, JsonPipe, AppButton],
  templateUrl: './mcp-example-card.html',
  styleUrl: './mcp-example-card.scss',
})
export class McpExampleCard implements OnChanges, OnDestroy {
  private readonly client = inject(McpClient);
  private activeRequest?: Subscription;

  @Input({ required: true }) example!: McpExample;
  @Input({ required: true }) token = '';

  inputValue = '';
  readonly loading = signal(false);
  readonly result = signal<McpToolResult<unknown> | null>(null);
  readonly error = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['example']) this.inputValue = this.example.initialValue;
    if (changes['token'] && !changes['token'].firstChange) this.reset();
  }

  ngOnDestroy(): void {
    this.activeRequest?.unsubscribe();
  }

  run(): void {
    if (this.loading()) return;
    if (!this.token.trim()) {
      this.error.set('Informe um token JWT antes de executar.');
      return;
    }
    const args = this.argumentsFromInput();
    if (!args) return;

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);
    this.activeRequest = this.client.call<unknown>(this.example.name, args, this.token).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(error instanceof McpClientError ? error.message : 'Não foi possível executar a tool.');
        this.loading.set(false);
      },
    });
  }

  preview(): object {
    const value = this.inputValue.trim();
    const args = this.example.name === 'get_order'
      ? { orderId: Number(value) || value }
      : this.example.name === 'check_inventory'
        ? { sku: value.toUpperCase() }
        : { query: value };
    return { jsonrpc: '2.0', method: 'tools/call', params: { name: this.example.name, arguments: args } };
  }

  statusLabel(status: string): string {
    return ({ ok: 'Concluído', not_found: 'Não encontrado', invalid_input: 'Entrada inválida', unavailable: 'API indisponível' } as Record<string, string>)[status] ?? status;
  }

  private argumentsFromInput(): Record<string, string | number> | null {
    const value = this.inputValue.trim();
    let message: string | null = null;
    if (this.example.name === 'search_customer') {
      if (value.length < 1 || value.length > 100) message = 'Informe de 1 a 100 caracteres para a busca.';
      if (!message) return { query: value };
    } else if (this.example.name === 'get_order') {
      if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) message = 'Informe um ID de pedido positivo.';
      if (!message) return { orderId: Number(value) };
    } else {
      if (!/^[A-Za-z0-9-]{1,64}$/.test(value)) message = 'Informe um SKU de 1 a 64 letras, números ou hífens.';
      if (!message) return { sku: value.toUpperCase() };
    }
    this.error.set(message);
    this.result.set(null);
    return null;
  }

  private reset(): void {
    this.activeRequest?.unsubscribe();
    this.loading.set(false);
    this.result.set(null);
    this.error.set(null);
  }
}
