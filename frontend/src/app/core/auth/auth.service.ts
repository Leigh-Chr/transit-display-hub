import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subject, tap } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { LoginRequest, LoginResponse, UserRole, AuthUser } from '@shared/models';

interface JwtPayload {
  sub: string;
  role: string;
  exp: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';

  private readonly tokenSignal = signal<string | null>(this.getStoredToken());

  /** URL the user was on when they got bumped to /login. Set by the auth
   *  interceptor on 401 and consumed by LoginComponent after a successful
   *  re-login so the user lands back where they were. */
  private readonly redirectUrlSignal = signal<string | null>(null);

  /** Fires once per logout so long-lived peripherals (WebSocket clients) can
   *  drop their session along with the token, instead of staying subscribed
   *  on behalf of an account that no longer exists in this tab. */
  private readonly logoutSubject = new Subject<void>();
  readonly logout$ = this.logoutSubject.asObservable();

  isAuthenticated = computed(() => {
    const token = this.tokenSignal();
    if (!token) {return false;}
    return !this.isTokenExpired(token);
  });

  currentUser = computed<AuthUser | null>(() => {
    const token = this.tokenSignal();
    if (!token) {return null;}
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return {
        username: decoded.sub,
        role: decoded.role as UserRole
      };
    } catch {
      return null;
    }
  });

  isAdmin = computed(() => {
    return this.currentUser()?.role === 'ADMIN';
  });

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', request).pipe(
      tap(response => {
        localStorage.setItem(this.TOKEN_KEY, response.token);
        this.tokenSignal.set(response.token);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.tokenSignal.set(null);
    this.logoutSubject.next();
    void this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  getRole(): UserRole | null {
    const user = this.currentUser();
    return user ? user.role : null;
  }

  setRedirectUrl(url: string | null): void {
    this.redirectUrlSignal.set(url);
  }

  /** Returns the stored redirect URL once and clears it, so login can navigate
   *  the user back without leaving a stale value behind for the next session. */
  consumeRedirectUrl(): string | null {
    const url = this.redirectUrlSignal();
    if (url !== null) { this.redirectUrlSignal.set(null); }
    return url;
  }

  /** Read the persisted token, dropping it if it's already expired so the rest
   *  of the app never sees a stale credential it would only hand back to the
   *  server (which would then 401 and bounce the user mid-action). */
  private getStoredToken(): string | null {
    const stored = localStorage.getItem(this.TOKEN_KEY);
    if (stored !== null && this.isTokenExpired(stored)) {
      localStorage.removeItem(this.TOKEN_KEY);
      return null;
    }
    return stored;
  }

  /** 30 s of leeway between client and server clocks: the typical drift on a
   *  laptop after a long sleep is enough to throw a freshly-issued token into
   *  "expired" territory if we compare strictly. */
  private static readonly CLOCK_SKEW_SECONDS = 30;

  private isTokenExpired(token: string): boolean {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return (decoded.exp + AuthService.CLOCK_SKEW_SECONDS) * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
