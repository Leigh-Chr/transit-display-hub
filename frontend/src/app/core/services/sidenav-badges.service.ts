import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { DashboardService } from '@core/api/dashboard.service';
import { MessageService } from '@core/api/message.service';

/**
 * Lightweight in-shell counters surfaced as badges on sidenav items.
 *
 * For an admin: polls {@code /api/admin/dashboard} every minute and
 * exposes active-message + offline-device counts. For an agent: polls
 * {@code /api/messages} and exposes the active-message count only.
 *
 * Refresh cadence is intentionally coarse (60s) — the dashboard page
 * already shows live data; the sidenav badges are a coarse-grained
 * "something needs attention" indicator, not a real-time monitor.
 */
@Injectable({ providedIn: 'root' })
export class SidenavBadgesService {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  private static readonly POLL_INTERVAL_MS = 60_000;

  readonly activeMessagesCount = signal(0);
  readonly offlineDevicesCount = signal(0);

  /** True when a fetch has been attempted at least once — avoids
   *  flashing a misleading "0" on the very first render before the
   *  request completes. Templates should hide badges while false. */
  readonly hasData = computed(() => this.lastFetchAt() !== null);
  private readonly lastFetchAt = signal<number | null>(null);

  private pollSubscription: Subscription | null = null;

  constructor() {
    // Re-evaluate the polling target whenever the auth state flips
    // (login, logout, role change). The effect tears down any in-
    // flight timer before re-arming so we never end up with two.
    effect(() => {
      const user = this.authService.currentUser();
      this.stop();
      if (user) {
        this.refresh();
        this.pollSubscription = interval(SidenavBadgesService.POLL_INTERVAL_MS).subscribe(() => {
          this.refresh();
        });
      } else {
        this.activeMessagesCount.set(0);
        this.offlineDevicesCount.set(0);
        this.lastFetchAt.set(null);
      }
    });

    this.destroyRef.onDestroy(() => this.stop());
  }

  /** Public so the dashboard can poke a refresh right after a mutation
   *  (creating a message, dismissing a device) — keeps the badge in
   *  sync without waiting for the next tick. */
  refresh(): void {
    if (this.authService.isAdmin()) {
      this.dashboardService.getSummary().subscribe({
        next: (summary) => {
          this.activeMessagesCount.set(summary.activeMessages.length);
          this.offlineDevicesCount.set(summary.devices.offline);
          this.lastFetchAt.set(Date.now());
        },
        error: () => {
          // Silent: the dashboard page will surface the real error if
          // the user opens it. The badge just stops updating.
        },
      });
    } else {
      this.messageService.getAll().subscribe({
        next: (messages) => {
          this.activeMessagesCount.set(messages.filter((m) => m.active).length);
          this.lastFetchAt.set(Date.now());
        },
        error: () => undefined,
      });
    }
  }

  private stop(): void {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
      this.pollSubscription = null;
    }
  }
}
