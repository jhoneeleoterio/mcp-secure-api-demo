import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { QueryState } from './query-state';

describe('QueryState', () => {
  it('ignores a stale response when a newer query starts', () => {
    const state = new QueryState<string>(TestBed.inject(DestroyRef));
    const first = new Subject<string>();
    const second = new Subject<string>();
    const mapError = () => ({ message: 'Falha', retry: true });

    state.run(first, mapError);
    state.run(second, mapError);
    first.next('antigo');
    second.next('atual');

    expect(state.data()).toBe('atual');
    expect(first.observed).toBe(false);
    expect(state.loading()).toBe(false);
  });
});
