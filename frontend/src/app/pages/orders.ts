import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommerceApi, Order } from '../core/commerce-api';

@Component({
  selector: 'app-orders',
  imports: [FormsModule, RouterLink, CurrencyPipe],
  template: `
    <section class="page-heading"><p class="eyebrow">Pedidos</p><h1>Consulte um pedido</h1><p>Veja status, itens e total pelo número do pedido.</p></section>
    <form class="search-form" (ngSubmit)="submit()">
      <label for="order-id">Número do pedido</label>
      <div class="search-row"><input id="order-id" name="id" [(ngModel)]="idInput" inputmode="numeric" autocomplete="off" [attr.aria-invalid]="validationError() ? true : null" [attr.aria-describedby]="validationError() ? 'order-error' : null" placeholder="Ex.: 1002" /><button class="button primary" type="submit">Consultar</button></div>
      @if (validationError()) { <p id="order-error" class="field-error" role="alert">{{ validationError() }}</p> }
    </form>
    @if (loading()) { <p class="feedback" role="status">Carregando pedido…</p> }
    @else if (error()) { <div class="feedback error" role="alert"><p>{{ error() }}</p>@if (canRetry()) { <button class="button secondary" type="button" (click)="load(Number(idInput))">Tentar novamente</button> }</div> }
    @else if (order(); as current) {
      <section class="card detail-card" aria-label="Detalhes do pedido">
        <div class="detail-top"><div><p class="eyebrow">Pedido #{{ current.id }}</p><h2>Detalhes do pedido</h2></div><span class="pill">{{ statusLabel(current.status) }}</span></div>
        <dl class="detail-meta"><div><dt>Cliente</dt><dd>#{{ current.customerId }}</dd></div><div><dt>Moeda</dt><dd>{{ current.currency }}</dd></div></dl>
        <h3>Itens</h3>
        <div class="item-list">
          @for (item of current.items; track item.sku) {
            <div class="item-row"><div><a class="text-link" [routerLink]="['/inventory', item.sku]">{{ item.sku }} →</a><p>{{ item.quantity }} {{ item.quantity === 1 ? 'unidade' : 'unidades' }}</p></div><strong>{{ item.unitPrice | currency:current.currency:'symbol':'1.2-2':'pt-BR' }} / un.</strong></div>
          }
        </div>
        <div class="total-row"><span>Total</span><strong>{{ current.total | currency:current.currency:'symbol':'1.2-2':'pt-BR' }}</strong></div>
      </section>
    }
  `,
})
export class OrdersPage {
  private readonly api = inject(CommerceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private activeRequest?: Subscription;
  protected readonly Number = Number;
  idInput = '';
  readonly order = signal<Order | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);
  readonly canRetry = signal(false);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const id = params.get('id');
      if (id !== null) {
        this.idInput = id;
        if (this.validate(id)) this.load(Number(id));
      }
    });
  }

  submit() {
    const value = this.idInput.trim();
    if (!this.validate(value)) return;
    if (this.route.snapshot.paramMap.get('id') === value) this.load(Number(value));
    else void this.router.navigate(['/orders', value]);
  }

  load(id: number) {
    this.activeRequest?.unsubscribe();
    this.order.set(null);
    this.error.set(null);
    this.canRetry.set(false);
    this.loading.set(true);
    this.activeRequest = this.api.order(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: order => { this.order.set(order); this.loading.set(false); },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.status === 404 ? 'Pedido não encontrado.' : 'Não foi possível consultar o pedido agora.');
        this.canRetry.set(err.status !== 404);
        this.loading.set(false);
      },
    });
  }

  statusLabel(status: string): string {
    return ({ processing: 'Em processamento', shipped: 'Enviado' } as Record<string, string>)[status] ?? status;
  }

  private validate(value: string): boolean {
    const valid = /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647;
    this.validationError.set(valid ? null : 'Informe um número de pedido inteiro e positivo.');
    return valid;
  }
}
