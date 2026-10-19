import { Component, Input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';

@Component({
  selector: 'app-action-card',
  imports: [RouterLink],
  templateUrl: './action-card.html',
  styleUrl: './action-card.scss',
})
export class ActionCard {
  @Input({ required: true }) title = '';
  @Input({ required: true }) description = '';
  @Input({ required: true }) link: string | (string | number)[] = '/';
  @Input() queryParams?: Params;
  @Input() icon = '→';
}
