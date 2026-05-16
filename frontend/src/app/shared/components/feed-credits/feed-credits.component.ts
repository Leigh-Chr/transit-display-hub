import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AttributionService } from '@core/api/attribution.service';
import { Attribution } from '@shared/models';

/**
 * GTFS attributions footer block. Renders organization names with their
 * roles (producer / operator / authority) — the spec recommends crediting
 * these on every public passenger surface. Stays silent when the feed
 * doesn't ship `attributions.txt`.
 */
@Component({
  selector: 'app-feed-credits',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (attributions().length > 0) {
      <footer class="feed-credits" aria-label="GTFS feed credits">
        <mat-icon class="credits-icon" aria-hidden="true">verified</mat-icon>
        @for (attr of attributions(); track $index; let last = $last) {
          <span class="credit-item">
            @if (attr.url) {
              <a [href]="attr.url" target="_blank" rel="noopener noreferrer">{{ attr.organizationName }}</a>
            } @else {
              {{ attr.organizationName }}
            }
            <span class="roles">
              @if (attr.producer) { <span class="role role-producer">producer</span> }
              @if (attr.operator) { <span class="role role-operator">operator</span> }
              @if (attr.authority) { <span class="role role-authority">authority</span> }
            </span>
          </span>
          @if (!last) { <span class="separator" aria-hidden="true">·</span> }
        }
      </footer>
    }
  `,
  styles: `
    .feed-credits {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 14px;
      padding: 10px 16px;
      font-size: var(--m3-type-label-medium);
      color: var(--app-on-surface-muted, #6b7280);
      border-top: 1px solid var(--app-divider, rgba(0, 0, 0, 0.08));
    }

    .credits-icon {
      font-size: var(--m3-type-body-large);
      width: 16px;
      height: 16px;
      color: var(--app-tone-success, var(--app-success));
    }

    .credit-item {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
    }

    .credit-item a {
      color: inherit;
      text-decoration: underline dotted;
    }

    .roles {
      display: inline-flex;
      gap: 4px;
    }

    .role {
      padding: 1px 7px;
      border-radius: 999px;
      font-size: var(--m3-type-label-small);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .role-producer {
      background: rgba(99, 102, 241, 0.14);
      color: var(--app-chip-info-fg);
    }

    .role-operator {
      background: rgba(16, 185, 129, 0.14);
      color: var(--app-chip-success-fg);
    }

    .role-authority {
      background: rgba(244, 114, 182, 0.16);
      color: var(--app-chip-accent-fg);
    }

    .separator {
      color: var(--app-on-surface-muted, #9ca3af);
    }
  `,
})
export class FeedCreditsComponent implements OnInit {
  private readonly attributionService = inject(AttributionService);

  protected readonly attributions = signal<Attribution[]>([]);

  ngOnInit(): void {
    this.attributionService.getAllAttributions().subscribe({
      next: (data) => this.attributions.set(data),
      error: () => this.attributions.set([]),
    });
  }
}
