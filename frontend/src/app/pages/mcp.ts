import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { McpClient, McpClientError } from '../core/mcp-client';
import { AppButton } from '../ui/button';
import { McpExample, McpExampleCard } from '../ui/mcp-example-card';

@Component({
  selector: 'app-mcp-page',
  imports: [FormsModule, AppButton, McpExampleCard],
  templateUrl: './mcp.html',
  styleUrl: './mcp.scss',
})
export class McpPage {
  private readonly client = inject(McpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly token = signal('');
  readonly demoLoading = signal(false);
  readonly demoError = signal<string | null>(null);
  readonly demoExpiresAt = signal<string | null>(null);

  readonly examples: McpExample[] = [
    {
      name: 'search_customer',
      title: 'Buscar cliente',
      description: 'Procura clientes pelo nome, e-mail ou ID exato.',
      scope: 'customers.read',
      inputLabel: 'Texto da busca',
      initialValue: 'Alice',
    },
    {
      name: 'get_order',
      title: 'Consultar pedido',
      description: 'Retorna o pedido, seus itens e o total.',
      scope: 'orders.read',
      inputLabel: 'ID do pedido',
      initialValue: '1002',
    },
    {
      name: 'check_inventory',
      title: 'Verificar estoque',
      description: 'Mostra o produto e a quantidade disponível.',
      scope: 'inventory.read',
      inputLabel: 'SKU do produto',
      initialValue: 'ABC-123',
    },
  ];

  clearToken(): void {
    this.token.set('');
    this.demoExpiresAt.set(null);
    this.demoError.set(null);
  }

  setToken(value: string): void {
    this.token.set(value);
    this.demoExpiresAt.set(null);
    this.demoError.set(null);
  }

  activateDemo(): void {
    if (this.demoLoading()) return;
    this.demoLoading.set(true);
    this.demoError.set(null);
    this.client.requestDemoToken().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (demo) => {
        this.token.set(demo.accessToken);
        this.demoExpiresAt.set(demo.expiresAt);
        this.demoLoading.set(false);
      },
      error: (error: unknown) => {
        this.demoError.set(error instanceof McpClientError ? error.message : 'Não foi possível ativar o demo.');
        this.demoLoading.set(false);
      },
    });
  }
}
