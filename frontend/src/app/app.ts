import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommerceApi } from './core/commerce-api';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  templateUrl: './app.html',
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
