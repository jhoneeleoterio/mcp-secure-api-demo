import { Component, Input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-toolbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
})
export class AppToolbar {
  @Input() availability: 'checking' | 'ready' | 'unavailable' = 'checking';
  readonly drawerOpen = signal(false);
  close() {
    this.drawerOpen.set(false);
  }
  onEscape() {
    if (this.drawerOpen()) this.close();
  }
}
