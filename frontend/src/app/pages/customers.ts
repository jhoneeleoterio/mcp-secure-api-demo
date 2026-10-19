import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommerceApi, Customer } from '../core/commerce-api';

@Component({
  selector: 'app-customers',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page-heading"><p class="eyebrow">Clientes</p><h1>Encontre um cliente</h1><p>Pesquise por parte do nome, e-mail ou ID exato.</p></section>
    <form class="search-form" (ngSubmit)="submit()">
      <label for="customer-query">Nome, e-mail ou ID</label>
      <div class="search-row"><input id="customer-query" name="query" [(ngModel)]="query" maxlength="100" autocomplete="off" [attr.aria-invalid]="validationError() ? true : null" [attr.aria-describedby]="validationError() ? 'customer-error' : null" placeholder="Ex.: Alice" /><button class="button primary" type="submit">Buscar</button></div>
      @if (validationError()) { <p id="customer-error" class="field-error" role="alert">{{ validationError() }}</p> }
    </form>
    @if (loading()) { <p class="feedback" role="status">Buscando clientes…</p> }
    @else if (error()) { <div class="feedback error" role="alert"><p>{{ error() }}</p><button class="button secondary" type="button" (click)="load(query.trim())">Tentar novamente</button></div> }
    @else if (results(); as customers) {
      @if (customers.length === 0) { <p class="feedback">Nenhum cliente encontrado. Tente outro termo.</p> }
      @else {
        <p class="result-count" role="status">{{ customers.length }} {{ customers.length === 1 ? 'cliente encontrado' : 'clientes encontrados' }}</p>
        <div class="result-list">
          @for (customer of customers; track customer.id) {
            <article class="card customer-card"><div><span class="eyebrow">Cliente #{{ customer.id }}</span><h2>{{ customer.name }}</h2><p>{{ customer.email }}</p></div><div>
              @if (customer.latestOrderId !== null) { <a class="text-link" [routerLink]="['/orders', customer.latestOrderId]">Ver pedido #{{ customer.latestOrderId }} →</a> }
              @else { <span class="muted">Sem pedido registrado</span> }
            </div></article>
          }
        </div>
      }
    }
  `,
})
export class CustomersPage {
  private readonly api = inject(CommerceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private activeRequest?: Subscription;
  query = '';
  readonly results = signal<Customer[] | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const value = params.get('query');
      if (value !== null) { this.query = value; this.load(value.trim()); }
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
    this.activeRequest?.unsubscribe();
    this.validationError.set(null);
    this.results.set(null);
    this.error.set(null);
    this.loading.set(true);
    this.activeRequest = this.api.customers(term).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: customers => { this.results.set(customers); this.loading.set(false); },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.status === 400 ? 'A busca foi recusada. Confira o termo informado.' : 'Não foi possível buscar clientes agora.');
        this.loading.set(false);
      },
    });
  }

  private validate(term: string): boolean {
    const message = !term ? 'Digite um termo para buscar.' : term.length > 100 ? 'Use no máximo 100 caracteres.' : null;
    this.validationError.set(message);
    return message === null;
  }
}
