import { DestroyRef, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subscription } from 'rxjs';

export interface QueryError {
  message: string;
  retry: boolean;
}

/** Common HTTP view state. Starting another request cancels the previous one. */
export class QueryState<T> {
  private active?: Subscription;
  readonly data = signal<T | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly canRetry = signal(false);
  readonly hasData = computed(() => this.data() !== null);

  constructor(private readonly destroyRef: DestroyRef) {}

  run(request: Observable<T>, mapError: (error: HttpErrorResponse) => QueryError) {
    this.active?.unsubscribe();
    this.data.set(null);
    this.error.set(null);
    this.canRetry.set(false);
    this.loading.set(true);
    this.active = request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        this.data.set(value);
        this.loading.set(false);
      },
      error: (cause: HttpErrorResponse) => {
        const error = mapError(cause);
        this.error.set(error.message);
        this.canRetry.set(error.retry);
        this.loading.set(false);
      },
    });
  }
}
