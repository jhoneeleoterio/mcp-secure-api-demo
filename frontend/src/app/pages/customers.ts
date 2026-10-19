import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommerceApi, Customer } from '../core/commerce-api';
import { AppButton } from '../ui/button';
import { FeedbackPanel } from '../ui/feedback';
import { QueryState } from '../ui/query-state';
import { ResultList } from '../ui/result-list';
import { SearchField } from '../ui/search-field';

@Component({
  selector: 'app-customers',
  imports: [AppButton, FeedbackPanel, ResultList, SearchField],
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
})
export class CustomersPage {
  private readonly api = inject(CommerceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly state = new QueryState<Customer[]>(this.destroyRef);
  readonly validationError = signal<string | null>(null);
  query = '';

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const value = params.get('query');
      if (value !== null) {
        this.query = value;
        this.load(value.trim());
      }
    });
  }

  submit() {
    const term = this.query.trim();
    if (!this.validate(term)) return;
    if (this.route.snapshot.queryParamMap.get('query') === term) this.load(term);
    else void this.router.navigate([], { relativeTo: this.route, queryParams: { query: term } });
  }

  load(term: string) {
    if (!this.validate(term)) return;
    this.validationError.set(null);
    this.state.run(this.api.customers(term), (error: HttpErrorResponse) => ({
      message:
        error.status === 400
          ? 'A busca foi recusada. Confira o termo informado.'
          : 'Não foi possível buscar clientes agora.',
      retry: error.status !== 400,
    }));
  }

  private validate(term: string): boolean {
    const message = !term
      ? 'Digite um termo para buscar.'
      : term.length > 100
        ? 'Use no máximo 100 caracteres.'
        : null;
    this.validationError.set(message);
    return message === null;
  }
}
