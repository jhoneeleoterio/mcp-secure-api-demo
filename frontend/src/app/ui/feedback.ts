import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AppButton } from './button';

@Component({
  selector: 'app-feedback',
  imports: [AppButton],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss',
})
export class FeedbackPanel {
  @Input() kind: 'loading' | 'empty' | 'error' | 'info' = 'info';
  @Input({ required: true }) message = '';
  @Input() retry = false;
  @Output() retryClick = new EventEmitter<void>();
}
