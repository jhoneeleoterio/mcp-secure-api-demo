import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommerceApi, Inventory } from '../core/commerce-api';
import { FeedbackPanel } from '../ui/feedback';
import { QueryState } from '../ui/query-state';
import { SearchField } from '../ui/search-field';

@Component({
  selector: 'app-inventory',
  imports: [FeedbackPanel, SearchField],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
})
export class InventoryPage {
  private readonly api = inject(CommerceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly state = new QueryState<Inventory>(this.destroyRef);
  readonly validationError = signal<string | null>(null);
  skuInput = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
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
    this.state.run(this.api.inventory(sku), (error: HttpErrorResponse) => ({
      message:
        error.status === 404
          ? 'Produto não encontrado.'
          : 'Não foi possível consultar o estoque agora.',
      retry: error.status !== 404,
    }));
  }

  private validate(sku: string): boolean {
    const valid = /^[A-Za-z0-9-]{1,64}$/.test(sku);
    this.validationError.set(valid ? null : 'Informe um SKU de até 64 letras, números ou hífens.');
    return valid;
  }
}
