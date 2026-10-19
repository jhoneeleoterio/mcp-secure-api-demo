import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommerceApi } from './core/commerce-api';
import { AppToolbar } from './ui/toolbar';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AppToolbar],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly api = inject(CommerceApi);
  protected readonly availability = signal<'checking' | 'ready' | 'unavailable'>('checking');

  constructor() {
    this.api.ready().subscribe({
      next: () => this.availability.set('ready'),
      error: () => this.availability.set('unavailable'),
    });
  }
}
