import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoOverview, DemoOverviewService } from '../core/demo-overview';
import { orderStatusLabel } from '../core/commerce-api';
import { AppButton } from '../ui/button';
import { ActionCard } from '../ui/action-card';
import { FeedbackPanel } from '../ui/feedback';
import { QueryState } from '../ui/query-state';

@Component({
  selector: 'app-home',
  imports: [CurrencyPipe, RouterLink, AppButton, ActionCard, FeedbackPanel],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  readonly statusLabel = orderStatusLabel;
  private readonly overviewService = inject(DemoOverviewService);
  readonly state = new QueryState<DemoOverview>(inject(DestroyRef));

  constructor() {
    this.load();
  }

  load() {
    this.state.run(this.overviewService.load(), (_error: HttpErrorResponse) => ({
      message: 'Não foi possível carregar os dados da demonstração. Confira a conexão com a API.',
      retry: true,
    }));
  }
}
