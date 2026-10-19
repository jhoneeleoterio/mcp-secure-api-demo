import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-result-list',
  templateUrl: './result-list.html',
  styleUrl: './result-list.scss',
})
export class ResultList {
  @Input({ required: true }) count = 0;
  @Input() singular = 'resultado';
  @Input() plural = 'resultados';
  @Input() showCount = true;
  @Input() variant: 'cards' | 'rows' = 'cards';
}
