import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** A future protected request must opt in explicitly. No current REST call does. */
export const REQUIRES_AUTH = new HttpContextToken<boolean>(() => false);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accessToken = signal<string | null>(null);
  readonly isAuthenticated = () => this.accessToken() !== null;
  token() { return this.accessToken(); }
  setAccessToken(token: string) { this.accessToken.set(token); }
  clear() { this.accessToken.set(null); }
}

export const authGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() ? true : inject(Router).createUrlTree(['/']);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).token();
  const url = new URL(request.url, globalThis.location.origin);
  if (!request.context.get(REQUIRES_AUTH) || !token || url.origin !== globalThis.location.origin) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
