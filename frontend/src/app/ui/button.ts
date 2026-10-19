import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Params, RouterLink } from '@angular/router';

@Component({
  selector: 'app-button',
  imports: [RouterLink],
  templateUrl: './button.html',
  styleUrl: './button.scss',
})
export class AppButton {
  @Input({ required: true }) label = '';
  @Input() variant: 'primary' | 'secondary' | 'ghost' = 'primary';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() link?: string | (string | number)[];
  @Input() queryParams?: Params;
  @Input() disabled = false;
  @Output() pressed = new EventEmitter<void>();
}
