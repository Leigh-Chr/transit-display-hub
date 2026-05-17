import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeedInfoService } from '@core/api/feed-info.service';
import { FeedInfo } from '@shared/models';
import { TranslocoDirective } from '@jsverse/transloco';

/**
 * Compact card surfacing GTFS feed provenance and validity status, rendered
 * in the admin dashboard. Three states:
 *   - {@code none}    no feed imported yet
 *   - {@code expired} the feed's declared {@code endDate} has lapsed
 *   - {@code expiring} less than 7 days remain before {@code endDate}
 *   - {@code current} otherwise
 */
@Component({
  selector: 'app-feed-info-card',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatIconModule, MatTooltipModule, TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    @if (loaded() && feed(); as info) {
      <mat-card class="feed-info-card" [class.expired]="status() === 'expired'" [class.expiring]="status() === 'expiring'">
        <mat-card-content>
          <div class="feed-header">
            <mat-icon class="feed-icon" [matTooltip]="statusTooltip(t)">{{ statusIcon() }}</mat-icon>
            <div class="feed-title">
              <strong>{{ info.publisherName || t('admin.dashboard.feedInfo.defaultTitle') }}</strong>
              @if (info.feedVersion) {
                <span class="feed-version">v{{ info.feedVersion }}</span>
              }
            </div>
          </div>
          <div class="feed-grid">
            @if (info.startDate || info.endDate) {
              <div class="feed-line">
                <mat-icon class="feed-line-icon">event</mat-icon>
                <span>
                  {{ info.startDate ? (info.startDate | date:'mediumDate') : '?' }}
                  &rarr;
                  {{ info.endDate ? (info.endDate | date:'mediumDate') : '?' }}
                  @if (daysRemaining() !== null) {
                    <span class="days-remaining">({{ daysRemaining() }} {{ daysRemaining() === 1 ? t('admin.dashboard.feedInfo.dayLeft') : t('admin.dashboard.feedInfo.daysLeft') }})</span>
                  }
                </span>
              </div>
            }
            @if (info.importedAt) {
              <div class="feed-line">
                <mat-icon class="feed-line-icon">cloud_download</mat-icon>
                <span>{{ t('admin.dashboard.feedInfo.imported') }} {{ info.importedAt | date:'medium' }}</span>
              </div>
            }
            @if (info.sourceUrl) {
              <div class="feed-line feed-line-truncate" [matTooltip]="info.sourceUrl">
                <mat-icon class="feed-line-icon">link</mat-icon>
                <span>{{ info.sourceUrl }}</span>
              </div>
            }
            @if (info.lang || info.defaultLang) {
              <div class="feed-line">
                <mat-icon class="feed-line-icon">translate</mat-icon>
                <span>
                  {{ t('admin.dashboard.feedInfo.sourceLang') }} <strong>{{ info.lang || '?' }}</strong>
                  @if (info.defaultLang && info.defaultLang !== info.lang) {
                    · {{ t('admin.dashboard.feedInfo.defaultLang') }} <strong>{{ info.defaultLang }}</strong>
                  }
                </span>
              </div>
            }
          </div>
        </mat-card-content>
      </mat-card>
    }
    </ng-container>
  `,
  styles: `
    :host {
      display: block;
    }

    .feed-info-card {
      border-left: 4px solid var(--mat-sys-primary);
    }

    .feed-info-card.expiring {
      border-left-color: var(--app-warning);
    }

    .feed-info-card.expired {
      border-left-color: var(--app-critical);
    }

    .feed-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .feed-icon {
      font-size: var(--m3-type-headline-large);
      width: 28px;
      height: 28px;
    }

    .feed-info-card.expiring .feed-icon { color: var(--app-warning); }
    .feed-info-card.expired .feed-icon { color: var(--app-critical); }
    .feed-info-card:not(.expiring):not(.expired) .feed-icon {
      color: var(--mat-sys-primary);
    }

    .feed-title {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: var(--m3-type-title-large);
    }

    .feed-version {
      font-size: var(--m3-type-body-medium);
      opacity: 0.75;
      font-variant-numeric: tabular-nums;
    }

    .feed-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .feed-line {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--m3-type-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .feed-line-icon {
      font-size: var(--m3-type-title-large);
      width: 18px;
      height: 18px;
      opacity: 0.7;
    }

    .feed-line-truncate span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .days-remaining {
      margin-left: 6px;
      opacity: 0.85;
    }
  `,
})
export class FeedInfoCardComponent implements OnInit {
  private readonly feedInfoService = inject(FeedInfoService);

  readonly feed = signal<FeedInfo | null>(null);
  readonly loaded = signal<boolean>(false);

  readonly daysRemaining = computed<number | null>(() => {
    const info = this.feed();
    if (!info?.endDate) {
      return null;
    }
    const end = Date.parse(info.endDate + 'T00:00:00Z');
    if (Number.isNaN(end)) { return null; }
    const today = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    );
    return Math.floor((end - today) / 86_400_000);
  });

  readonly status = computed<'none' | 'expired' | 'expiring' | 'current'>(() => {
    if (!this.feed()) { return 'none'; }
    const remaining = this.daysRemaining();
    if (remaining === null) { return 'current'; }
    if (remaining < 0) { return 'expired'; }
    if (remaining < 7) { return 'expiring'; }
    return 'current';
  });

  readonly statusIcon = computed(() => {
    switch (this.status()) {
      case 'expired': return 'error_outline';
      case 'expiring': return 'schedule';
      default: return 'verified';
    }
  });

  statusTooltip(t: (key: string) => string): string {
    switch (this.status()) {
      case 'expired': return t('admin.dashboard.feedInfo.statusExpired');
      case 'expiring': return t('admin.dashboard.feedInfo.statusExpiring');
      default: return t('admin.dashboard.feedInfo.statusCurrent');
    }
  }

  ngOnInit(): void {
    this.feedInfoService.getFeedInfo().subscribe({
      next: (feed) => {
        this.feed.set(feed);
        this.loaded.set(true);
      },
      error: () => {
        // Silently swallow — non-admin users (forbidden) and missing
        // endpoints shouldn't crash the dashboard. The card simply
        // stays hidden when {@code loaded} is true and {@code feed} null.
        this.loaded.set(true);
      },
    });
  }
}
