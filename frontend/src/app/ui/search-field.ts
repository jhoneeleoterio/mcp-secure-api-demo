import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppButton } from './button';

@Component({
  selector: 'app-search-field',
  imports: [FormsModule, AppButton],
  templateUrl: './search-field.html',
  styleUrl: './search-field.scss',
})
export class SearchField {
  @Input({ required: true }) fieldId = '';
  @Input({ required: true }) label = '';
  @Input() placeholder = '';
  @Input() buttonLabel = 'Buscar';
  @Input() inputMode: 'text' | 'numeric' = 'text';
  @Input() maxLength?: number;
  @Input() value = '';
  @Input() error: string | null = null;
  @Output() valueChange = new EventEmitter<string>();
  @Output() searched = new EventEmitter<string>();
}
