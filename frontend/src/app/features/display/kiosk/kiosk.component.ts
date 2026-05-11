import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  effect,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DisplayService } from '@core/api/display.service';
import { ThemeService } from '@core/services/theme.service';
import { WebSocketService } from '@core/websocket/websocket.service';
import { ArrivalInfo, DisplayState, HubArrivalInfo, PickupKind } from '@shared/models';
import { lineTextColor } from '@shared/utils/color.utils';
import { LocaleService } from '@core/i18n/locale.service';
import { formatLocaleDate } from '@shared/utils/locale-date.utils';

@Component({
  selector: 'app-kiosk',
  standalone: true,
  imports: [
    NgOptimizedImage,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kiosk">
      @if (displayState()) {
        <!-- Header: Stop name with line badges + Current time -->
        <header class="header">
          <img ngSrc="assets/logo.png" width="40" height="40" alt="" class="header-logo" priority>
          <div class="stop-info">
            <h1 class="stop-name">
              {{ displayState()!.stopName }}
              @if (displayState()!.stopShortCode; as code) {
                <span class="stop-short-code">{{ code }}</span>
              }
            </h1>
            <div class="header-lines">
              @for (line of displayState()!.lines; track line.code) {
                <span class="header-line-badge"
                      [style.backgroundColor]="line.color"
                      [style.color]="lineTextColor(line)">
                  {{ line.code }}
                </span>
              }
            </div>
          </div>
          <div class="clock-container">
            <div class="date">{{ currentDate() }}</div>
            <div class="clock">{{ currentTime() }}</div>
          </div>
          <!-- Accessibility controls: high-contrast palette, large
               text, vocal announcement of the next departure. The
               buttons stay in the top-right corner so a passenger
               can reach them whatever the layout. aria-pressed is
               the canonical WAI-ARIA way to expose toggle state to
               assistive tech. -->
          <div class="a11y-controls" role="group" [attr.aria-label]="'kiosk.highContrast' | transloco">
            <button
              mat-icon-button
              type="button"
              [attr.aria-pressed]="themeService.isHighContrast()"
              [attr.aria-label]="'kiosk.highContrast' | transloco"
              [matTooltip]="'kiosk.highContrast' | transloco"
              (click)="themeService.toggleHighContrast()">
              <mat-icon>contrast</mat-icon>
            </button>
            <button
              mat-icon-button
              type="button"
              [attr.aria-pressed]="themeService.isLargeText()"
              [attr.aria-label]="'kiosk.largeText' | transloco"
              [matTooltip]="'kiosk.largeText' | transloco"
              (click)="themeService.toggleLargeText()">
              <mat-icon>format_size</mat-icon>
            </button>
            <button
              mat-icon-button
              type="button"
              [attr.aria-label]="'kiosk.speakNext' | transloco"
              [matTooltip]="'kiosk.speakNext' | transloco"
              [disabled]="!speechAvailable"
              (click)="speakNextDeparture()">
              <mat-icon>volume_up</mat-icon>
            </button>
          </div>
        </header>

        <!-- Critical alert (scrolling banner) -->
        @if (criticalMessages().length > 0) {
          <div class="alert-banner">
            <div class="alert-icon">
              <mat-icon>warning</mat-icon>
            </div>
            <div class="alert-wrapper">
              <div class="alert-track" [style.animationDuration]="alertDuration()">
                <div class="alert-content">
                  @for (message of criticalMessages(); track $index) {
                    <span class="alert-item">
                      <strong>{{ message.title }}</strong>
                      @if (message.content) {
                        <span class="alert-detail">— {{ message.content }}</span>
                      }
                    </span>
                    <span class="alert-separator">•</span>
                  }
                </div>
                <div class="alert-content">
                  @for (message of criticalMessages(); track $index) {
                    <span class="alert-item">
                      <strong>{{ message.title }}</strong>
                      @if (message.content) {
                        <span class="alert-detail">— {{ message.content }}</span>
                      }
                    </span>
                    <span class="alert-separator">•</span>
                  }
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Main departures board -->
        <main class="departures">
          <div class="departures-header">
            <span class="col-line">{{ 'kiosk.headerLine' | transloco }}</span>
            <span class="col-destination">{{ 'kiosk.headerDestination' | transloco }}</span>
            <span class="col-time">{{ 'kiosk.headerNextDeparture' | transloco }}</span>
          </div>
          <div class="departures-viewport">
            <div class="departures-track"
                 [class.scrolling]="needsScrolling()"
                 [class.reduced-motion]="reducedMotion()"
                 [style.animationDuration]="scrollDuration()">
              <div class="departures-list">
                @for (arrival of visibleArrivals(); track (arrival.line.code + '-' + arrival.destinationName)) {
                  <div class="departure-row">
                    <span
                      class="line-badge"
                      [style.backgroundColor]="arrival.line.color"
                      [style.color]="lineTextColor(arrival.line)"
                    >
                      {{ arrival.line.code }}
                    </span>
                    @if (showPerArrivalPlatform(arrival)) {
                      <span class="platform-badge"
                            [attr.aria-label]="'kiosk.accessibility.platform' | transloco:{ code: arrival.platformCode }">
                        {{ arrival.platformCode }}
                      </span>
                    }
                    <span class="destination">
                      {{ arrival.destinationName }}
                      @if (arrival.wheelchairAccessible === 'ACCESSIBLE') {
                        <mat-icon class="access-icon access-yes" [attr.aria-label]="'kiosk.accessibility.wheelchairYes' | transloco">accessible_forward</mat-icon>
                      } @else if (arrival.wheelchairAccessible === 'NOT_ACCESSIBLE') {
                        <mat-icon class="access-icon access-no" [attr.aria-label]="'kiosk.accessibility.wheelchairNo' | transloco">do_not_disturb</mat-icon>
                      }
                      @if (arrival.bikesAllowed === 'ALLOWED') {
                        <mat-icon class="access-icon access-yes" [attr.aria-label]="'kiosk.accessibility.bikesAllowed' | transloco">directions_bike</mat-icon>
                      }
                      @if (pickupBadge(arrival.pickupKind); as badge) {
                        <span class="pickup-badge">{{ badge }}</span>
                      }
                      @if (frequencyLabel(arrival.frequencyHeadwaySeconds); as freq) {
                        <span class="pickup-badge frequency-badge">{{ freq }}</span>
                      }
                      @if (isLive(arrival.realtimeDelaySeconds)) {
                        <span class="live-badge"
                              [class.delay-late]="(arrival.realtimeDelaySeconds ?? 0) > 60"
                              [class.delay-early]="(arrival.realtimeDelaySeconds ?? 0) < -60"
                              [attr.aria-label]="'kiosk.accessibility.liveData' | transloco">
                          ● {{ liveLabel(arrival.realtimeDelaySeconds) }}
                        </span>
                      }
                      @if (arrival.booking; as b) {
                        <span class="booking-badge" [attr.aria-label]="bookingAria(b)">
                          <mat-icon class="booking-icon">phone_callback</mat-icon>
                          @if (b.phone) {
                            {{ b.phone }}
                          } @else {
                            {{ 'kiosk.booking.label' | transloco }}
                          }
                          @if (b.priorNoticeMinutes) {
                            <span class="booking-notice">≥ {{ b.priorNoticeMinutes }} min</span>
                          }
                        </span>
                      }
                    </span>
                    <span class="time-info">
                      <span
                        class="time-relative"
                        [class.imminent]="isImminent(effectiveTime(arrival))"
                      >{{ formatRelativeTime(effectiveTime(arrival)) }}</span>
                      <span class="time-absolute">{{ formatDepartureTime(effectiveTime(arrival)) }}</span>
                    </span>
                  </div>
                } @empty {
                  <div class="no-departures">
                    {{ 'kiosk.noScheduledDepartures' | transloco }}
                  </div>
                }
              </div>
              <!-- Duplicate for seamless loop when scrolling.
                   Hidden under prefers-reduced-motion — the paginated view
                   replaces continuous scroll and requires no clone. -->
              @if (needsScrolling() && !reducedMotion()) {
                <div class="list-divider"></div>
                <div class="departures-list">
                  @for (arrival of allArrivals(); track (arrival.line.code + '-' + arrival.destinationName)) {
                    <div class="departure-row">
                      <span
                        class="line-badge"
                        [style.backgroundColor]="arrival.line.color"
                        [style.color]="lineTextColor(arrival.line)"
                      >
                        {{ arrival.line.code }}
                      </span>
                      <span class="destination">
                        {{ arrival.destinationName }}
                        @if (pickupBadge(arrival.pickupKind); as badge) {
                          <span class="pickup-badge">{{ badge }}</span>
                        }
                      </span>
                      <span class="time-info">
                        <span
                        class="time-relative"
                        [class.imminent]="isImminent(effectiveTime(arrival))"
                      >{{ formatRelativeTime(effectiveTime(arrival)) }}</span>
                        <span class="time-absolute">{{ formatDepartureTime(effectiveTime(arrival)) }}</span>
                      </span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </main>

        <!-- Info/Warning messages ticker -->
        @if (infoMessages().length > 0) {
          <aside class="info-ticker">
            <div class="ticker-track" [style.animationDuration]="tickerDuration()">
              <div class="ticker-content">
                @for (message of infoMessages(); track $index) {
                  <span class="ticker-item" [class.ticker-warning]="message.severity === 'WARNING'">
                    <mat-icon>{{ message.severity === 'WARNING' ? 'warning' : 'info' }}</mat-icon>
                    <strong>{{ message.title }}</strong>
                    @if (message.content) {
                      <span class="ticker-detail">{{ message.content }}</span>
                    }
                  </span>
                  <span class="ticker-separator">•</span>
                }
              </div>
              <!-- Duplicate for seamless loop -->
              <div class="ticker-content">
                @for (message of infoMessages(); track $index) {
                  <span class="ticker-item" [class.ticker-warning]="message.severity === 'WARNING'">
                    <mat-icon>{{ message.severity === 'WARNING' ? 'warning' : 'info' }}</mat-icon>
                    <strong>{{ message.title }}</strong>
                    @if (message.content) {
                      <span class="ticker-detail">{{ message.content }}</span>
                    }
                  </span>
                  <span class="ticker-separator">•</span>
                }
              </div>
            </div>
          </aside>
        }

        <!-- Connection status indicator (minimal) -->
        @if (!connected()) {
          <div class="connection-warning" role="status" aria-live="polite">
            <mat-icon aria-hidden="true">wifi_off</mat-icon>
            {{ 'kiosk.connection.reconnecting' | transloco }}
          </div>
        } @else if (isStale()) {
          <div class="connection-warning stale-warning" role="status" aria-live="polite">
            <mat-icon aria-hidden="true">schedule</mat-icon>
            {{ 'kiosk.connection.stale' | transloco:{ minutes: staleMinutes() } }}
          </div>
        }
      } @else if (error()) {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <h1>{{ 'kiosk.error.title' | transloco }}</h1>
          <p>{{ error() }}</p>
        </div>
      } @else {
        <div class="loading-state">
          <mat-spinner diameter="80" aria-label="Loading display"></mat-spinner>
          <h1>{{ 'kiosk.loading' | transloco }}</h1>
        </div>
      }
    </div>
  `,
  styles: `
    /* ===========================================
       KIOSK DISPLAY - Optimized for readability
       Target: 1920x1080 screens, 3-5m viewing distance
       =========================================== */

    :host {
      display: block;
      background: var(--app-kiosk-surface);
      color: var(--app-kiosk-on-surface);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    .kiosk {
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 2vh 2.5vw;
      box-sizing: border-box;
    }

    /* --- Header --- */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1.5vh;
      border-bottom: 0.4vh solid var(--app-kiosk-border);
      margin-bottom: 1.5vh;
      gap: 2vw;
    }

    .header-logo {
      width: 5vh;
      height: 5vh;
      flex-shrink: 0;
      filter: brightness(0) invert(1);
      opacity: 0.9;
    }

    .stop-name {
      font-size: 6vh;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .stop-short-code {
      display: inline-block;
      margin-left: 1.2vw;
      padding: 0.4vh 1vw;
      border-radius: 0.5vh;
      font-size: 2.5vh;
      font-weight: 600;
      letter-spacing: 0.08em;
      vertical-align: middle;
      color: var(--app-kiosk-on-surface-muted);
      border: 0.2vh solid var(--app-kiosk-border);
      font-variant-numeric: tabular-nums;
    }

    .header-lines {
      display: flex;
      gap: 0.8vw;
      margin-top: 0.8vh;
    }

    .header-line-badge {
      padding: 0.5vh 1vw;
      border-radius: 0.5vh;
      font-size: 3vh;
      font-weight: 700;
      color: var(--app-kiosk-on-surface);
      text-shadow: 0 1px 2px var(--app-kiosk-text-shadow);
    }

    .clock-container {
      text-align: right;
    }

    .date {
      font-size: 3vh;
      font-weight: 500;
      color: var(--app-kiosk-on-surface-muted);
      margin-bottom: 0.5vh;
    }

    .clock {
      font-size: 8vh;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }

    /* --- Accessibility toolbar --- */
    .a11y-controls {
      display: flex;
      align-items: center;
      gap: 0.5vh;
      margin-left: 1.5vh;
      padding: 0.4vh 0.6vh;
      background: var(--app-kiosk-surface-variant, rgba(255, 255, 255, 0.06));
      border-radius: 0.6vh;
    }
    .a11y-controls button {
      width: 5vh;
      height: 5vh;
      min-width: 44px;
      min-height: 44px;
      color: var(--app-kiosk-on-surface);
    }
    .a11y-controls button[aria-pressed='true'] {
      background: var(--app-kiosk-on-surface);
      color: var(--app-kiosk-surface);
    }
    .a11y-controls mat-icon {
      font-size: 3vh;
      width: 3vh;
      height: 3vh;
    }

    /* --- Alert Banner (scrolling) --- */
    .alert-banner {
      display: flex;
      align-items: center;
      background: var(--app-kiosk-alert-bg);
      margin-bottom: 1vh;
      border-radius: 0.5vh;
    }

    .alert-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.2vh 1.5vw;
      flex-shrink: 0;
    }

    .alert-icon mat-icon {
      font-size: 3vh;
      width: 3vh;
      height: 3vh;
    }

    .alert-wrapper {
      flex: 1;
      overflow: hidden;
      padding: 1.2vh 0;
      padding-right: 2vw;
    }

    .alert-track {
      display: flex;
      animation: alert-scroll linear infinite;
      width: max-content;
    }

    .alert-content {
      display: flex;
      align-items: center;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .alert-item {
      font-size: 3vh;
      line-height: 1.3;
    }

    .alert-item strong {
      font-weight: 700;
    }

    .alert-detail {
      opacity: 0.9;
      margin-left: 0.5vw;
    }

    .alert-separator {
      margin: 0 2vw;
      opacity: 0.5;
    }

    @keyframes alert-scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    /* --- Departures Board --- */
    .departures {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .departures-header {
      display: flex;
      align-items: center;
      padding: 1vh 1vw;
      font-size: 3vh;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--app-kiosk-on-surface-muted);
      border-bottom: 0.1vh solid var(--app-kiosk-border-subtle);
      flex-shrink: 0;
    }

    .col-line {
      width: 8vw;
      text-align: center;
    }

    .col-destination {
      flex: 1;
      padding-left: 2vw;
    }

    .col-time {
      min-width: 22vw;
      text-align: right;
    }

    .departure-row {
      display: flex;
      align-items: center;
      padding: 1.5vh 1vw;
      border-bottom: 0.1vh solid var(--app-kiosk-border-faint);
    }

    .line-badge {
      width: 8vw;
      text-align: center;
      font-size: clamp(3vh, 4vh, 5vh);
      font-weight: 700;
      padding: 1vh 0;
      border-radius: 0.5vh;
      color: var(--app-kiosk-on-surface);
      text-shadow: 0 1px 3px var(--app-kiosk-text-shadow-strong);
      flex-shrink: 0;
    }

    .destination {
      flex: 1;
      font-size: clamp(3vh, 4.5vh, 6vh);
      font-weight: 500;
      padding-left: 2vw;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pickup-badge {
      display: inline-block;
      margin-left: 1vw;
      padding: 0.3vh 0.8vw;
      border-radius: 0.4vh;
      font-size: clamp(1.5vh, 2vh, 2.5vh);
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      vertical-align: middle;
      background: var(--app-kiosk-info-bg-subtle);
      color: var(--app-kiosk-info-accent);
      border: 1px solid var(--app-kiosk-info-border);
    }

    .frequency-badge {
      background: transparent;
      border-color: var(--app-kiosk-info-accent);
    }

    .live-badge {
      display: inline-block;
      margin-left: 1vw;
      padding: 0.3vh 0.8vw;
      border-radius: 0.4vh;
      font-size: clamp(1.5vh, 2vh, 2.5vh);
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      vertical-align: middle;
      background: rgba(46, 204, 113, 0.18);
      color: rgb(46, 174, 96);
      border: 1px solid rgba(46, 204, 113, 0.6);
      /* Pulsing dot evokes the "live data" idiom from broadcast UIs */
      animation: live-pulse 2s ease-in-out infinite;
    }

    .live-badge.delay-late {
      background: rgba(231, 76, 60, 0.18);
      color: rgb(192, 57, 43);
      border-color: rgba(231, 76, 60, 0.6);
    }

    .live-badge.delay-early {
      background: rgba(241, 196, 15, 0.18);
      color: rgb(180, 134, 6);
      border-color: rgba(241, 196, 15, 0.6);
    }

    @keyframes live-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.65; }
    }

    /* Per-arrival platform badge — only renders on parent-station
       kiosks where each arrival comes from a different quay. Sized
       to read at the same scale as the line badge so the eye groups
       them as "where + which line". */
    .platform-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 4vw;
      padding: 0.4vh 0.8vw;
      margin-left: 1vw;
      border-radius: 0.4vh;
      font-size: clamp(2vh, 2.6vh, 3.2vh);
      font-weight: 700;
      letter-spacing: 0.02em;
      background: var(--mat-sys-tertiary-container, rgba(96, 56, 200, 0.18));
      color: var(--mat-sys-on-tertiary-container, rgb(72, 38, 156));
      border: 1px solid var(--mat-sys-tertiary, rgba(96, 56, 200, 0.55));
      vertical-align: middle;
      font-variant-numeric: tabular-nums;
    }

    /* TAD booking CTA — phone or "Réservation" inline so a passenger
       reading a TAD arrival sees the action immediately. */
    .booking-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4vw;
      margin-left: 1vw;
      padding: 0.3vh 0.8vw;
      border-radius: 0.4vh;
      font-size: clamp(1.5vh, 2vh, 2.5vh);
      font-weight: 700;
      letter-spacing: 0.02em;
      vertical-align: middle;
      background: rgba(56, 142, 235, 0.16);
      color: rgb(34, 105, 192);
      border: 1px solid rgba(56, 142, 235, 0.55);
    }

    .booking-icon {
      font-size: clamp(2vh, 2.5vh, 3vh) !important;
      width: clamp(2vh, 2.5vh, 3vh) !important;
      height: clamp(2vh, 2.5vh, 3vh) !important;
    }

    .booking-notice {
      font-size: 0.85em;
      font-weight: 500;
      opacity: 0.8;
      margin-left: 0.4vw;
    }

    .access-icon {
      vertical-align: middle;
      margin-left: 0.8vw;
      font-size: clamp(2.5vh, 3.5vh, 4.5vh) !important;
      width: clamp(2.5vh, 3.5vh, 4.5vh) !important;
      height: clamp(2.5vh, 3.5vh, 4.5vh) !important;
    }

    .access-icon.access-yes {
      color: var(--app-kiosk-info-accent);
    }

    .access-icon.access-no {
      color: var(--app-kiosk-warning-accent);
      opacity: 0.85;
    }

    .time-info {
      display: flex;
      align-items: baseline;
      justify-content: flex-end;
      gap: 1.5vw;
      min-width: 22vw;
      text-align: right;
    }

    .time-relative {
      font-size: clamp(3.5vh, 5vh, 7vh);
      font-weight: 700;
      color: var(--app-kiosk-on-surface);
    }

    /* Imminent: the bus is leaving now. Pop visually so a passenger
       glancing across the platform spots it without parsing every row. */
    .time-relative.imminent {
      color: var(--app-kiosk-info-accent);
      animation: imminentPulse 1.4s ease-in-out infinite;
    }

    @keyframes imminentPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.62; }
    }

    .time-absolute {
      font-size: clamp(2.5vh, 3.5vh, 5vh);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: var(--app-kiosk-on-surface-muted);
    }

    /* --- Departures Viewport (scrolling container) --- */
    .departures-viewport {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .departures-track {
      display: flex;
      flex-direction: column;
    }

    .departures-track.scrolling {
      animation: vertical-scroll linear infinite;
    }

    @keyframes vertical-scroll {
      0% { transform: translateY(0); }
      100% { transform: translateY(-50%); }
    }

    /* prefers-reduced-motion: replace continuous scroll with discrete page-swaps.
       The .reduced-motion class is applied by the component when the media query
       matches. The global reduced-motion override (styles.scss §13b) sets
       animation-duration to 0.01ms which would stop scrolling, but the viewport
       would show only the first row because the track stays at translateY(0) and
       content below is overflow:hidden. We disable the animation explicitly here
       and let the paginated visibleArrivals() signal rotate the rows instead. */
    @media (prefers-reduced-motion: reduce) {
      .departures-track.scrolling {
        animation: none;
      }
    }

    .departures-list {
      display: flex;
      flex-direction: column;
    }

    .list-divider {
      height: 0.3vh;
      margin: 2vh 5vw;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    }

    .no-departures {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 4vh;
      color: var(--app-kiosk-on-surface-muted);
      min-height: 20vh;
    }

    /* --- Info Ticker --- */
    .info-ticker {
      margin-top: auto;
      padding-top: 1.5vh;
      overflow: hidden;
      background: linear-gradient(90deg, var(--app-kiosk-info-bg) 0%, var(--app-kiosk-info-bg-subtle) 50%, var(--app-kiosk-info-bg) 100%);
      border-radius: 0.5vh;
      border-top: 0.3vh solid var(--app-kiosk-info-border);
    }

    .ticker-track {
      display: flex;
      overflow: hidden;
      padding: 1.5vh 0;
      animation: ticker-scroll linear infinite;
      width: max-content;
    }

    .ticker-content {
      display: flex;
      align-items: center;
      white-space: nowrap;
      flex-shrink: 0;
    }

    @keyframes ticker-scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .ticker-item {
      display: inline-flex;
      align-items: center;
      gap: 0.8vw;
      font-size: 3vh;
      color: var(--app-kiosk-info-accent);
    }

    .ticker-warning {
      color: var(--app-kiosk-warning-accent);
    }

    .ticker-item mat-icon {
      font-size: 3vh;
      width: 3vh;
      height: 3vh;
    }

    .ticker-item strong {
      font-weight: 600;
    }

    .ticker-detail {
      margin-left: 0.5vw;
      opacity: 0.85;
    }

    .ticker-separator {
      margin: 0 3vw;
      color: var(--app-kiosk-on-surface-muted);
      font-size: 3vh;
    }

    /* --- Connection Warning (only shown when disconnected) --- */
    .connection-warning {
      position: fixed;
      bottom: 1.5vh;
      right: 2vw;
      display: flex;
      align-items: center;
      gap: 0.8vw;
      background: var(--app-kiosk-connection-error);
      padding: 0.8vh 1.5vw;
      border-radius: 0.5vh;
      font-size: 3vh;
      font-weight: 500;
      /* Calm pulse instead of harsh blink — passengers in a station already
         have enough flicker around them. */
      animation: connectionPulse 2.4s ease-in-out infinite;
    }

    .connection-warning mat-icon {
      font-size: 3vh;
      width: 3vh;
      height: 3vh;
    }

    /* Stale variant — link is up but the server has gone quiet. Less alarming
       than the disconnected state but still flagged so passengers don't
       trust ghost departures. */
    .connection-warning.stale-warning {
      background: var(--app-kiosk-warning-accent);
      color: #1a1a1a;
      animation: none;
    }

    @keyframes connectionPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.78; }
    }

    /* --- Error & Loading States --- */
    .error-state,
    .loading-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .error-state mat-icon {
      font-size: 12vh;
      width: 12vh;
      height: 12vh;
      color: var(--app-kiosk-error-icon);
      margin-bottom: 3vh;
    }

    .error-state h1,
    .loading-state h1 {
      font-size: 5vh;
      font-weight: 600;
      margin: 2vh 0;
    }

    .error-state p {
      font-size: 3vh;
      color: var(--app-kiosk-on-surface-muted);
      max-width: 60vw;
    }

    .loading-state mat-spinner {
      margin-bottom: 3vh;
    }

    /* --- Responsive for smaller screens --- */
    @media (max-height: 800px) {
      .stop-name { font-size: 5vh; }
      .clock { font-size: 6vh; }
      .ticker-item { font-size: 3vh; }
      .ticker-item mat-icon { font-size: 3vh; width: 3vh; height: 3vh; }
    }

    /* Portrait mode optimization */
    @media (orientation: portrait) {
      .header { flex-direction: column; align-items: flex-start; gap: 1vh; }
      .clock-container { align-self: flex-end; }
      .clock { font-size: 6vh; }
      .line-badge { width: 12vw; }
      .time-info { min-width: 28vw; }
    }
  `,
})
export class KioskComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly displayService = inject(DisplayService);
  private readonly wsService = inject(WebSocketService);
  private readonly transloco = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);
  /** Exposed to the template so the a11y toolbar can bind to its
   *  three signals (dark / contrast / large text) directly. */
  readonly themeService = inject(ThemeService);

  /** Cached on construction so the template's `[disabled]` binding
   *  doesn't probe the platform on every change-detection run. */
  readonly speechAvailable = typeof window !== 'undefined'
      && 'speechSynthesis' in window;

  displayState = signal<DisplayState | null>(null);
  error = signal<string | null>(null);
  currentTime = signal(this.formatTime(new Date()));
  currentDate = signal(this.formatDate(new Date()));

  // Exposed to the template so badges pick the server-resolved foreground
  // color (route_text_color from GTFS) before falling back to YIQ contrast.
  readonly lineTextColor = lineTextColor;

  /** Renders the frequency headway as a short "every X min" label.
   *  Null when the arrival is on a fixed timetable so the template
   *  skips the badge entirely. Headways under 60 seconds round to
   *  "every minute" — a strict 30s read would surprise passengers
   *  whose mental model is "minutes between buses". */
  frequencyLabel(headwaySeconds: number | null | undefined): string | null {
    if (!headwaySeconds || headwaySeconds <= 0) {return null;}
    const minutes = Math.round(headwaySeconds / 60);
    if (minutes <= 1) {return this.transloco.translate('kiosk.frequency.everyMinute');}
    return this.transloco.translate('kiosk.frequency.everyMinutes', { minutes });
  }

  /** Maps a {@link PickupKind} to a short label rendered next to the
   *  destination name. Returns null for {@code NORMAL} (no badge needed)
   *  and for unknown kinds so the template can use the {@code @if/as}
   *  pattern cleanly. */
  pickupBadge(kind: PickupKind | undefined): string | null {
    switch (kind) {
      case 'DROP_OFF_ONLY': return this.transloco.translate('kiosk.pickup.dropOffOnly');
      case 'PICKUP_ONLY': return this.transloco.translate('kiosk.pickup.pickupOnly');
      case 'ON_REQUEST_AGENCY': return this.transloco.translate('kiosk.pickup.onRequestAgency');
      case 'ON_REQUEST_DRIVER': return this.transloco.translate('kiosk.pickup.onRequestDriver');
      default: return null;
    }
  }

  /** Returns true when the GTFS-RT cache holds an explicit update
   *  for this arrival — even when the delay is zero ("on time"
   *  matters for passengers because it means the data is live, not
   *  theoretical). */
  isLive(delaySeconds: number | null | undefined): boolean {
    return delaySeconds !== null && delaySeconds !== undefined;
  }

  /** Short label rendered next to the live indicator: "à l'heure" / "on time",
   *  "+3 min", "−2 min". Sub-minute values collapse to the "on time" key
   *  to avoid screen churn at 30 s granularity. */
  liveLabel(delaySeconds: number | null | undefined): string {
    if (delaySeconds === null || delaySeconds === undefined) {return '';}
    const sign = delaySeconds >= 0 ? '+' : '−';
    const abs = Math.round(Math.abs(delaySeconds) / 60);
    if (abs === 0) {return this.transloco.translate('kiosk.onTime');}
    return `${sign}${abs} min`;
  }

  /** Announces the very first arrival on the board through the
   *  browser's Web Speech API. Used by the assistive button on the
   *  kiosk header. Falls through silently when no arrivals are
   *  available or the platform doesn't ship a synthesiser — the
   *  template gates the button on {@link speechAvailable} but a
   *  defensive check stays cheap. */
  speakNextDeparture(): void {
    const next = this.allArrivals()[0];
    if (!next) {
      this.speak(this.transloco.translate('kiosk.speak.noArrivals'));
      return;
    }
    const time = this.formatScheduledTime(next.scheduledTime);
    const delay = next.realtimeDelaySeconds ?? null;
    const params = { line: next.line.code, destination: next.destinationName, time };
    let text: string;
    if (delay === null) {
      text = this.transloco.translate('kiosk.speak.next', params);
    } else if (delay === 0) {
      text = this.transloco.translate('kiosk.speak.nextOnTime', params);
    } else if (delay > 0) {
      text = this.transloco.translate('kiosk.speak.nextDelayed', { ...params, minutes: Math.round(delay / 60) });
    } else {
      text = this.transloco.translate('kiosk.speak.nextEarly', { ...params, minutes: Math.round(Math.abs(delay) / 60) });
    }
    this.speak(text);
  }

  /** Wraps {@code window.speechSynthesis} so the speak handlers stay
   *  one-liners. Cancels any in-flight utterance first so a rapid
   *  double-press never queues two spoken announcements on top of
   *  each other. */
  private speak(text: string): void {
    if (!this.speechAvailable) {return;}
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  /** Pretty-prints a GTFS time string (HH:mm:ss or HH:mm) for vocal
   *  output. The synthesiser handles bare digits poorly ("zero
   *  eight forty-two"), but reading "08:42" via French locale yields
   *  the natural "huit heures quarante-deux" without the seconds. */
  private formatScheduledTime(raw: string): string {
    const trimmed = raw.length >= 5 ? raw.substring(0, 5) : raw;
    const [hh = '0', mm = '00'] = trimmed.split(':');
    return `${parseInt(hh, 10)} heures ${mm}`;
  }

  /** True when the per-arrival platform_code adds information vs.
   *  the kiosk's stop-level platform_code. On a per-platform kiosk
   *  the two match and rendering would be noise; on a parent-station
   *  kiosk the per-arrival value varies and is critical info. */
  showPerArrivalPlatform(arrival: ArrivalInfo): boolean {
    const arrivalPlatform = arrival.platformCode;
    if (!arrivalPlatform) {return false;}
    const stopPlatform = this.displayState()?.stopPlatformCode ?? null;
    return stopPlatform !== arrivalPlatform;
  }

  /** ARIA label for the booking badge — screen readers announce
   *  "réservation 0123456789, 30 minutes minimum" rather than just
   *  "phone_callback 0123456789". */
  bookingAria(b: { phone: string | null; priorNoticeMinutes: number | null }): string {
    const parts: string[] = [this.transloco.translate('kiosk.booking.aria')];
    if (b.phone) {parts.push(b.phone);}
    if (b.priorNoticeMinutes) {parts.push(`${b.priorNoticeMinutes} minutes minimum`);}
    return parts.join(', ');
  }

  /** Adds the realtime delay to the scheduled HH:mm so the relative
   *  countdown and absolute time both reflect what the passenger
   *  will actually see at the stop. The scheduled time on the
   *  payload stays untouched — we only project it forward at the
   *  render layer. */
  effectiveTime(arrival: ArrivalInfo | HubArrivalInfo): string {
    const delay = arrival.realtimeDelaySeconds;
    if (delay === null || delay === undefined || delay === 0) {
      return arrival.scheduledTime;
    }
    const parts = arrival.scheduledTime.split(':');
    const hours = parseInt(parts[0] ?? '0', 10);
    const minutes = parseInt(parts[1] ?? '0', 10);
    const seconds = parseInt(parts[2] ?? '0', 10);
    const total = hours * 3600 + minutes * 60 + seconds + delay;
    // Wrap into [0, 86400) so a late-night delay of 5 min on 23:58
    // displays as 00:03 the next day rather than 24:03.
    const wrapped = ((total % 86400) + 86400) % 86400;
    const hh = Math.floor(wrapped / 3600);
    const mm = Math.floor((wrapped % 3600) / 60);
    const ss = wrapped % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  constructor() {
    // Initialise the reducedMotion signal from the media query. A change
    // listener keeps the signal in sync if the user toggles the OS setting
    // while the kiosk is running (e.g. on a shared-use accessibility kiosk).
    const mql = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    this.reducedMotion = signal(mql?.matches ?? false);
    if (mql) {
      mql.addEventListener('change', (e) => {
        this.reducedMotion.set(e.matches);
      });
    }

    // When reduced-motion is active, advance the page index at a fixed interval
    // so arrivals that scroll off in normal mode are still reachable.
    effect(() => {
      if (this.reducedMotion()) {
        this.startPageSwap();
      } else {
        this.stopPageSwap();
        this.pageIndex.set(0);
      }
    });

    // Reset page index when the arrival list changes (stop switch, WS update)
    // so we don't land on an empty page.
    effect(() => {
      const total = this.allArrivals().length;
      const pageSize = KioskComponent.MAX_VISIBLE_ARRIVALS;
      const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
      if (this.pageIndex() > maxPage) {
        this.pageIndex.set(0);
      }
    });
  }

  private token: string | null = null;
  private stopId: string | null = null;
  private deviceId: string | null = null;
  private timeInterval: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  /** Wall-clock timestamp of the most recent state update (initial fetch or
   *  WebSocket push). Used to surface "data is stale" when the WS link is
   *  technically open but the backend has gone quiet (deleted stop, etc.). */
  lastUpdate = signal<number | null>(null);
  /** Threshold past which we consider the displayed state stale: 3 minutes.
   *  Long enough to ride out normal WS gaps, short enough to warn passengers
   *  before they trust ghost departures. */
  private static readonly STALE_THRESHOLD_MS = 3 * 60 * 1000;
  /** Re-evaluates against currentTime so the banner appears even if no new
   *  state ever arrives — the 1s clock signal drives the recompute. */
  isStale = computed(() => {
    this.currentTime();
    const last = this.lastUpdate();
    if (last === null) { return false; }
    return Date.now() - last > KioskComponent.STALE_THRESHOLD_MS;
  });
  /** Minutes since the last update, formatted for the banner. */
  staleMinutes = computed(() => {
    this.currentTime();
    const last = this.lastUpdate();
    if (last === null) { return 0; }
    return Math.floor((Date.now() - last) / 60000);
  });

  // Maximum arrivals that fit on screen without scrolling
  private static readonly MAX_VISIBLE_ARRIVALS = 5;
  // Seconds to display each arrival during scroll
  // Dwell time per visible arrival when the list scrolls. 4s gives a passenger
  // in motion a comfortable beat to scan line + destination + time without
  // feeling chased by the next row.
  private static readonly SECONDS_PER_ARRIVAL = 4;
  // Seconds between page-swaps in reduced-motion mode. 8s per page gives a
  // passenger enough time to read all rows before the next set appears.
  private static readonly REDUCED_MOTION_PAGE_DWELL_MS = 8000;

  /** True when the OS/browser signals that animations should be minimised.
   *  Reactive: updated via a MediaQueryList change event so the signal stays
   *  in sync even if the user toggles the system preference mid-session. */
  reducedMotion: ReturnType<typeof signal<boolean>>;

  /** Current page index for the paginated view used under reduced-motion. */
  private readonly pageIndex = signal(0);

  /** Page-swap interval reference — held so we can clear it on destroy. */
  private pageInterval: ReturnType<typeof setInterval> | null = null;

  // All arrivals from display state, filtered to exclude past departures
  allArrivals = computed(() => {
    // Re-evaluate when time changes
    this.currentTime();

    const arrivals = this.displayState()?.arrivals ?? [];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return arrivals.filter(arrival => {
      const parts = arrival.scheduledTime.split(':');
      const arrivalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
      // Wrap arrivals across midnight: when the scheduled time looks earlier than
      // `now` and the gap is large (>6h), treat it as tomorrow's arrival (night
      // service running into early morning). Anything older than 6h is genuinely
      // past and gets dropped.
      let delta = arrivalMinutes - currentMinutes;
      if (delta < -360) { delta += 1440; }
      return delta >= 0;
    });
  });

  /** Arrivals shown in the template. Under normal motion shows all arrivals
   *  (the CSS scroll animation handles overflow). Under reduced-motion, shows
   *  a page-sized slice that rotates every REDUCED_MOTION_PAGE_DWELL_MS so
   *  content that would scroll off is still reachable. */
  visibleArrivals = computed(() => {
    const all = this.allArrivals();
    if (!this.reducedMotion()) { return all; }
    const pageSize = KioskComponent.MAX_VISIBLE_ARRIVALS;
    const start = this.pageIndex() * pageSize;
    return all.slice(start, start + pageSize);
  });

  // Whether we need vertical scrolling (more arrivals than fit on screen).
  // Always false under reduced-motion — pagination replaces continuous scroll.
  needsScrolling = computed(() => {
    if (this.reducedMotion()) { return false; }
    const arrivals = this.allArrivals();
    const criticalCount = this.criticalMessages().length;
    const hasInfoMessages = this.infoMessages().length > 0;
    // Adjust visible count based on messages (same logic as before)
    const maxVisible = Math.max(3, Math.min(6, KioskComponent.MAX_VISIBLE_ARRIVALS - criticalCount + (hasInfoMessages ? 0 : 1)));
    return arrivals.length > maxVisible;
  });

  // Duration for one complete scroll cycle
  scrollDuration = computed(() => {
    const arrivals = this.allArrivals();
    // Time proportional to number of arrivals
    const duration = arrivals.length * KioskComponent.SECONDS_PER_ARRIVAL;
    return `${Math.max(10, duration)}s`;
  });

  criticalMessages = computed(() =>
    (this.displayState()?.messages ?? []).filter(
      (m) => m.severity === 'CRITICAL'
    )
  );

  infoMessages = computed(() =>
    (this.displayState()?.messages ?? []).filter(
      (m) => m.severity !== 'CRITICAL'
    )
  );

  // Calculate ticker scroll duration based on content length (slower = more readable)
  tickerDuration = computed(() => {
    const messages = this.infoMessages();
    const totalLength = messages.reduce((acc, m) =>
      acc + m.title.length + m.content.length, 0
    );
    // Base: 20s, add 2s per 50 characters for readability
    // Info ticker: shorter base (12s) than before so brief messages don't
    // hang on screen for a full 20s every cycle. Still grows with content.
    const duration = Math.max(10, 12 + Math.floor(totalLength / 50) * 2);
    return `${duration}s`;
  });

  // Calculate alert scroll duration (slower than info ticker for critical messages)
  alertDuration = computed(() => {
    const messages = this.criticalMessages();
    const totalLength = messages.reduce((acc, m) =>
      acc + m.title.length + m.content.length, 0
    );
    // Slower pace for critical messages: 15s base, add 3s per 50 chars
    const duration = Math.max(12, 15 + Math.floor(totalLength / 50) * 3);
    return `${duration}s`;
  });

  connected = computed(
    () => this.wsService.connectionState() === 'CONNECTED'
  );

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const routeStopId = String(params['stopId'] ?? '');
      if (routeStopId) {
        this.stopId = routeStopId;
        this.initializeWithStopId();
      }
    });

    this.route.queryParams.subscribe((params) => {
      this.token = String(params['token'] ?? '') || null;
      const queryStopId = String(params['stopId'] ?? '') || null;

      if (this.token) {
        this.initializeWithToken();
      } else if (queryStopId && !this.stopId) {
        this.stopId = queryStopId;
        this.initializeWithStopId();
      } else if (!this.stopId && !this.token) {
        this.error.set(
          'Missing device token or stop ID. Configure the display URL with /display/:stopId, ?token=<device-token>, or ?stopId=<stop-id>'
        );
      }
    });

    this.startClock();
    // Pause the clock while the tab is hidden — kiosks running 24/7 don't need
    // to burn CPU updating an off-screen clock once a second.
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.stopClock();
      } else {
        this.refreshClock();
        this.startClock();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnDestroy(): void {
    this.stopClock();
    this.stopPageSwap();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.wsService.disconnect();
  }

  private startPageSwap(): void {
    if (this.pageInterval !== null) { return; }
    this.pageInterval = setInterval(() => {
      const total = this.allArrivals().length;
      const pageSize = KioskComponent.MAX_VISIBLE_ARRIVALS;
      const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
      this.pageIndex.set(this.pageIndex() < maxPage ? this.pageIndex() + 1 : 0);
    }, KioskComponent.REDUCED_MOTION_PAGE_DWELL_MS);
  }

  private stopPageSwap(): void {
    if (this.pageInterval !== null) {
      clearInterval(this.pageInterval);
      this.pageInterval = null;
    }
  }

  private startClock(): void {
    if (this.timeInterval !== null) { return; }
    this.timeInterval = setInterval(() => this.refreshClock(), 1000);
  }

  private stopClock(): void {
    if (this.timeInterval !== null) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }

  private refreshClock(): void {
    const now = new Date();
    this.currentTime.set(this.formatTime(now));
    this.currentDate.set(this.formatDate(now));
  }

  private initializeWithToken(): void {
    if (!this.token) {
      return;
    }
    this.displayService.getStateByToken(this.token).subscribe({
      next: (authenticated) => {
        this.deviceId = authenticated.deviceId;
        this.displayState.set(authenticated.state);
        this.lastUpdate.set(Date.now());
        this.subscribeToUpdates(authenticated.state.stopId);
      },
      error: () => {
        this.error.set('Invalid device token or device not found.');
      },
    });
  }

  private initializeWithStopId(): void {
    if (!this.stopId) {
      return;
    }
    const stopId = this.stopId;
    this.displayService.getState(stopId).subscribe({
      next: (state) => {
        this.displayState.set(state);
        this.lastUpdate.set(Date.now());
        this.subscribeToUpdates(stopId);
      },
      error: () => {
        this.error.set('Stop not found.');
      },
    });
  }

  private subscribeToUpdates(stopId: string): void {
    this.wsService.connect(stopId, this.deviceId).subscribe({
      next: (state) => this.applyState(state),
      error: (err) => {
        console.error('WebSocket error:', err);
      },
    });

    // After a WebSocket interruption, the broker may have skipped pushes
    // (e.g. a stop was renamed, a message expired) — fetch a fresh snapshot
    // so the kiosk doesn't keep showing pre-disconnect state until the next
    // server-driven event.
    this.wsService.reconnected$.subscribe(() => this.refetchSnapshot(stopId));
  }

  /** Accept a state only if its version is monotone — drops out-of-order pushes
   *  that arrive after a newer one (broker queue reordering, retried fan-out).
   *  We still bump lastUpdate so the kiosk doesn't drift into "stale" state. */
  private applyState(state: DisplayState): void {
    const current = this.displayState();
    if (current && state.version < current.version) {
      this.lastUpdate.set(Date.now());
      return;
    }
    this.displayState.set(state);
    this.lastUpdate.set(Date.now());
  }

  /** Like applyState but unconditional: used right after reconnect/refetch when
   *  the version counter may have reset (backend restart, in-memory `versionMap`
   *  starting fresh). Without this the kiosk would freeze on stale data,
   *  rejecting every fresh state because its number is "lower" than the cached
   *  pre-restart one. */
  private resetState(state: DisplayState): void {
    this.displayState.set(state);
    this.lastUpdate.set(Date.now());
  }

  private refetchSnapshot(stopId: string): void {
    if (this.token) {
      this.displayService.getStateByToken(this.token).subscribe({
        next: (auth) => this.resetState(auth.state),
        error: (err: unknown) => {
          console.error('Failed to refresh snapshot after reconnect:', err);
        },
      });
    } else {
      this.displayService.getState(stopId).subscribe({
        next: (state) => this.resetState(state),
        error: (err: unknown) => {
          console.error('Failed to refresh snapshot after reconnect:', err);
        },
      });
    }
  }

  private formatTime(date: Date): string {
    return formatLocaleDate(date, this.localeService.current(), {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatDate(date: Date): string {
    return formatLocaleDate(date, this.localeService.current(), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatDepartureTime(time: string): string {
    // Time comes as "HH:MM:SS" or "HH:MM" - show only HH:MM
    const parts = time.split(':');
    return `${parts[0] ?? '00'}:${parts[1] ?? '00'}`;
  }

  getMinutesUntil(time: string): number {
    // Trigger recalculation when currentTime changes
    this.currentTime();

    const parts = time.split(':');
    const hours = parseInt(parts[0] ?? '0', 10);
    const minutes = parseInt(parts[1] ?? '0', 10);

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const departureMinutes = hours * 60 + minutes;

    // Wrap across midnight (same logic as allArrivals filter): a scheduled time
    // earlier than `now` with a large gap means tomorrow's departure.
    let delta = departureMinutes - nowMinutes;
    if (delta < -360) { delta += 1440; }
    return Math.max(0, delta);
  }

  formatRelativeTime(time: string): string {
    const minutes = this.getMinutesUntil(time);
    if (minutes === 0) {
      return this.transloco.translate('kiosk.imminent');
    }
    return this.transloco.translate('kiosk.minutesShort', { minutes });
  }

  /** Whether the next departure is happening now (within the same minute).
   *  Drives the highlighted `.imminent` styling on the relative-time pill. */
  isImminent(time: string): boolean {
    return this.getMinutesUntil(time) === 0;
  }
}
