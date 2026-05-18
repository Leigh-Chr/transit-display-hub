import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, Subject, tap } from 'rxjs';
import {
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  UserRole,
} from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** UI-facing identity reconstructed from /api/auth/me at boot
   *  and from the LoginResponse body on subsequent /login or /refresh. */
  private readonly userSignal = signal<AuthUser | null>(null);

  /** In-memory access JWT — kept ONLY because the STOMP CONNECT frame
   *  still authenticates via a Bearer header (cookies don't ride
   *  alongside STOMP frames). It is never written to localStorage so
   *  an XSS payload cannot lift it. */
  private readonly accessTokenSignal = signal<string | null>(null);

  /** URL the user was on when they got bumped to /login. Set by the auth
   *  interceptor on 401 and consumed by LoginComponent after a successful
   *  re-login so the user lands back where they were. */
  private readonly redirectUrlSignal = signal<string | null>(null);

  /** Mirrors the backend {@code passwordMustChange} flag — true when the
   *  caller landed on a freshly-seeded account (V52 seeded admin) or when
   *  an admin scheduled a forced rotation. The auth guard reads this and
   *  routes the user through {@code /auth/change-password} before letting
   *  them reach the admin shell. */
  private readonly passwordMustChangeSignal = signal(false);

  /** Fires once per logout so long-lived peripherals (WebSocket clients) can
   *  drop their session along with the token, instead of staying subscribed
   *  on behalf of an account that no longer exists in this tab. */
  private readonly logoutSubject = new Subject<void>();
  readonly logout$ = this.logoutSubject.asObservable();

  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  readonly currentUser = computed<AuthUser | null>(() => this.userSignal());

  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');

  /** Read-only flag indicating the backend asked us to rotate the password
   *  before letting the user continue (see {@code passwordMustChangeSignal}). */
  readonly passwordMustChange = this.passwordMustChangeSignal.asReadonly();

  /** Called once at app boot via provideAppInitializer. /api/auth/me reads
   *  the httpOnly ACCESS_TOKEN cookie and rebuilds the session if it's
   *  still valid; we then quietly /refresh to also mint a fresh JWT for
   *  the WebSocket layer. A 401 on either call simply leaves the app in
   *  the anonymous state, which is the right answer for public displays
   *  and the login screen alike. */
  async initializeSession(): Promise<void> {
    try {
      const me = await firstValueFrom(
        this.http.get<AuthUser>('/api/auth/me', { withCredentials: true })
      );
      this.userSignal.set(me);
      this.refreshAccessTokenSilently();
    } catch {
      this.userSignal.set(null);
      this.accessTokenSignal.set(null);
      this.passwordMustChangeSignal.set(false);
    }
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>('/api/auth/login', request, { withCredentials: true })
      .pipe(tap(response => this.hydrateFromResponse(response)));
  }

  /** Called by the HTTP interceptor on a 401 to mint a fresh access JWT
   *  from the REFRESH_TOKEN cookie. Resolves the rotated token so the
   *  caller can retry the original request. */
  refresh(): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>('/api/auth/refresh', null, { withCredentials: true })
      .pipe(tap(response => this.hydrateFromResponse(response)));
  }

  logout(): void {
    // Fire-and-forget — local state must clear even if the server is
    // unreachable so the user is not left in a half-authenticated UI.
    this.http
      .post('/api/auth/logout', null, { withCredentials: true })
      .subscribe({ next: () => undefined, error: () => undefined });

    this.userSignal.set(null);
    this.accessTokenSignal.set(null);
    this.passwordMustChangeSignal.set(false);
    this.logoutSubject.next();
    void this.router.navigate(['/login']);
  }

  /** Posts the rotation payload, clears the must-change flag on success
   *  so the next guard pass stops redirecting through the change-password
   *  route, and lets the caller component handle navigation. The backend
   *  returns 204 No Content, hence the {@code null} response type. */
  changePassword(request: ChangePasswordRequest): Observable<null> {
    return this.http
      .post<null>('/api/auth/change-password', request, { withCredentials: true })
      .pipe(tap(() => this.passwordMustChangeSignal.set(false)));
  }

  /** Returns the current access JWT used by the STOMP CONNECT header.
   *  Null when the session is anonymous or the post-boot /refresh has
   *  not yet returned. */
  getToken(): string | null {
    return this.accessTokenSignal();
  }

  getRole(): UserRole | null {
    return this.userSignal()?.role ?? null;
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

  private refreshAccessTokenSilently(): void {
    this.http
      .post<LoginResponse>('/api/auth/refresh', null, { withCredentials: true })
      .subscribe({
        next: (response) => {
          this.userSignal.set({ username: response.username, role: response.role });
          this.accessTokenSignal.set(response.token);
        },
        error: () => undefined
      });
  }

  /** Shared identity hydration used by login + interactive refresh.
   *  Kept separate from {@link refreshAccessTokenSilently} which
   *  intentionally skips {@code passwordMustChange} (silent boot-time
   *  refresh must not flip a flag the user has already cleared
   *  elsewhere in another tab). */
  private hydrateFromResponse(response: LoginResponse): void {
    this.userSignal.set({ username: response.username, role: response.role });
    this.accessTokenSignal.set(response.token);
    this.passwordMustChangeSignal.set(response.passwordMustChange);
  }
}
