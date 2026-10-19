import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommerceApi, Inventory } from '../core/commerce-api';

@Component({
  selector: 'app-inventory',
  imports: [FormsModule],
  template: `
    <section class="page-heading"><p class="eyebrow">Estoque</p><h1>Consulte um produto</h1><p>Informe o SKU para conferir a disponibilidade.</p></section>
    <form class="search-form" (ngSubmit)="submit()">
      <label for="inventory-sku">SKU do produto</label>
      <div class="search-row"><input id="inventory-sku" name="sku" [(ngModel)]="skuInput" maxlength="64" autocomplete="off" [attr.aria-invalid]="validationError() ? true : null" [attr.aria-describedby]="validationError() ? 'sku-error' : null" placeholder="Ex.: ABC-123" /><button class="button primary" type="submit">Consultar</button></div>
      @if (validationError()) { <p id="sku-error" class="field-error" role="alert">{{ validationError() }}</p> }
    </form>
    @if (loading()) { <p class="feedback" role="status">Consultando estoque…</p> }
    @else if (error()) { <div class="feedback error" role="alert"><p>{{ error() }}</p>@if (canRetry()) { <button class="button secondary" type="button" (click)="load(skuInput.toUpperCase())">Tentar novamente</button> }</div> }
    @else if (product(); as item) {
      <section class="card detail-card" aria-label="Estoque do produto">
        <p class="eyebrow">SKU {{ item.sku }}</p><h2>{{ item.productName }}</h2>
        <div class="stock-box" [class.empty]="item.availableQuantity === 0"><span>Disponibilidade</span><strong>{{ item.availableQuantity === 0 ? 'Sem estoque' : item.availableQuantity + ' unidades disponíveis' }}</strong></div>
      </section>
    }
  `,
})
export class InventoryPage {
  private readonly api = inject(CommerceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private activeRequest?: Subscription;
  skuInput = '';
  readonly product = signal<Inventory | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);
  readonly canRetry = signal(false);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const sku = params.get('sku');
      if (sku !== null) {
        this.skuInput = sku;
        if (this.validate(sku)) this.load(sku.toUpperCase());
      }
    });
  }

  submit() {
    const sku = this.skuInput.trim().toUpperCase();
    if (!this.validate(sku)) return;
    if (this.route.snapshot.paramMap.get('sku') === sku) this.load(sku);
    else void this.router.navigate(['/inventory', sku]);
  }

  load(sku: string) {
    this.activeRequest?.unsubscribe();
    this.product.set(null);
    this.error.set(null);
    this.canRetry.set(false);
    this.loading.set(true);
    this.activeRequest = this.api.inventory(sku).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: product => { this.product.set(product); this.loading.set(false); },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.status === 404 ? 'Produto não encontrado.' : 'Não foi possível consultar o estoque agora.');
        this.canRetry.set(err.status !== 404);
        this.loading.set(false);
      },
    });
  }

  private validate(sku: string): boolean {
    const valid = /^[A-Za-z0-9-]{1,64}$/.test(sku);
    this.validationError.set(valid ? null : 'Informe um SKU de até 64 letras, números ou hífens.');
    return valid;
  }
}
