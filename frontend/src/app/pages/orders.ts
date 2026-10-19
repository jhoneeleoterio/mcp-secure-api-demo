import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommerceApi, Order, orderStatusLabel } from '../core/commerce-api';
import { FeedbackPanel } from '../ui/feedback';
import { QueryState } from '../ui/query-state';
import { ResultList } from '../ui/result-list';
import { SearchField } from '../ui/search-field';

@Component({
  selector: 'app-orders',
  imports: [CurrencyPipe, RouterLink, FeedbackPanel, ResultList, SearchField],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class OrdersPage {
  readonly statusLabel = orderStatusLabel;
  private readonly api = inject(CommerceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly state = new QueryState<Order>(this.destroyRef);
  readonly validationError = signal<string | null>(null);
  idInput = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
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
    this.state.run(this.api.order(id), (error: HttpErrorResponse) => ({
      message:
        error.status === 404
          ? 'Pedido não encontrado.'
          : 'Não foi possível consultar o pedido agora.',
      retry: error.status !== 404,
    }));
  }

  private validate(value: string): boolean {
    const valid = /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647;
    this.validationError.set(valid ? null : 'Informe um número de pedido inteiro e positivo.');
    return valid;
  }
}
