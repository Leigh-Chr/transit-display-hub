import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '@core/i18n/locale.service';

import { Pathway, PathwayMode, StationPathwayGraph } from '@shared/models';

interface PathwayRow {
  pathway: Pathway;
  icon: string;
  label: string;
  durationLabel: string | null;
  detailLabel: string | null;
}

const MODE_ICON: Record<PathwayMode, string> = {
  WALKWAY: 'directions_walk',
  STAIRS: 'stairs',
  MOVING_SIDEWALK: 'moving_beds',
  ESCALATOR: 'escalator',
  ELEVATOR: 'elevator',
  FARE_GATE: 'door_sliding',
  EXIT_GATE: 'logout',
};

/**
 * Read-only renderer for a station's indoor topology graph. Inputs the
 * GTFS pathway graph rooted at a stop's parent station and lays the
 * pathways out by `pathway_mode` with quick descriptive labels:
 * "Ascenseur · 30 s · 12 marches · « Quai 2 »".
 *
 * Embedded in the public stop popup. Renders nothing when no pathways
 * exist — keeps the popup compact for stops without indoor topology.
 */
@Component({
  selector: 'app-pathway-list',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length > 0) {
      <div class="pathway-list" [attr.aria-label]="ariaLabel()">
        <h3 class="section-title">
          <mat-icon>alt_route</mat-icon>
          {{ titleLabel() }}
        </h3>
        @if (levelLine(); as line) {
          <p class="levels-line">{{ line }}</p>
        }
        <ul class="rows">
          @for (row of rows(); track row.pathway.id) {
            <li class="row">
              <mat-icon class="row-icon">{{ row.icon }}</mat-icon>
              <div class="row-body">
                <strong>{{ row.label }}</strong>
                <span class="row-meta">
                  {{ row.pathway.fromStopName }}
                  {{ row.pathway.bidirectional ? '↔' : '→' }}
                  {{ row.pathway.toStopName }}
                </span>
                @if (row.detailLabel) {
                  <span class="row-detail">{{ row.detailLabel }}</span>
                }
              </div>
              @if (row.durationLabel) {
                <span class="row-duration">{{ row.durationLabel }}</span>
              }
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: `
    .pathway-list {
      padding: 14px 20px 16px;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 8px;
      font-size: var(--m3-type-body-medium);
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }

    .section-title mat-icon {
      font-size: var(--m3-type-title-large);
      width: 18px;
      height: 18px;
    }

    .levels-line {
      margin: 0 0 10px;
      font-size: var(--m3-type-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 10px;
      background: var(--mat-sys-surface-container-low);
      border-radius: 4px;
    }

    .row-icon {
      font-size: var(--m3-type-headline-small);
      width: 20px;
      height: 20px;
      color: var(--mat-sys-primary);
      flex-shrink: 0;
      margin-top: 2px;
    }

    .row-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      font-size: var(--m3-type-body-medium);
    }

    .row-meta {
      color: var(--mat-sys-on-surface-variant);
      font-size: var(--m3-type-label-medium);
    }

    .row-detail {
      color: var(--mat-sys-on-surface-variant);
      font-size: var(--m3-type-label-medium);
      font-style: italic;
    }

    .row-duration {
      font-size: var(--m3-type-label-medium);
      color: var(--mat-sys-on-surface-variant);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }
  `,
})
export class PathwayListComponent {
  readonly graph = input<StationPathwayGraph | null>(null);

  private readonly transloco = inject(TranslocoService);
  // Track the active language so the row labels recompute when the
  // user toggles FR/EN — TranslocoService.translate() reads the dict
  // at call time and the `rows` computed re-runs on each lang switch.
  private readonly locale = inject(LocaleService);

  readonly rows = computed<PathwayRow[]>(() => {
    this.locale.current();
    const g = this.graph();
    if (!g) {return [];}
    return g.pathways.map(p => ({
      pathway: p,
      icon: MODE_ICON[p.pathwayMode],
      label: this.transloco.translate(`transit.pathwayMode.${p.pathwayMode}`),
      durationLabel: this.formatDuration(p.traversalTimeSeconds),
      detailLabel: this.detailFor(p),
    }));
  });

  readonly titleLabel = computed(() => {
    this.locale.current();
    return this.transloco.translate('pathways.title', {
      station: this.graph()?.stationName ?? '',
    });
  });

  readonly ariaLabel = computed(() => {
    this.locale.current();
    return this.transloco.translate('pathways.ariaLabel');
  });

  readonly levelLine = computed<string | null>(() => {
    this.locale.current();
    const g = this.graph();
    if (!g || g.levels.length === 0) {return null;}
    const labels = g.levels.map(l =>
      l.name ?? this.transloco.translate('pathways.fallbackLevel', { index: l.index }));
    const list = labels.join(', ');
    return this.transloco.translate(
      g.levels.length === 1 ? 'pathways.levelOne' : 'pathways.levelOther',
      { count: g.levels.length, list },
    );
  });

  private formatDuration(seconds: number | null): string | null {
    if (seconds === null) {return null;}
    if (seconds < 60) {
      return this.transloco.translate('pathways.durationSeconds', { value: seconds });
    }
    return this.transloco.translate('pathways.durationMinutes', { value: Math.round(seconds / 60) });
  }

  private detailFor(p: Pathway): string | null {
    const parts: string[] = [];
    if (p.stairCount !== null && p.stairCount !== 0) {
      const key = p.stairCount > 0 ? 'pathways.stairsUp' : 'pathways.stairsDown';
      parts.push(this.transloco.translate(key, { count: Math.abs(p.stairCount) }));
    }
    if (p.signpostedAs) {
      parts.push(this.transloco.translate('pathways.signpostedAs', { label: p.signpostedAs }));
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }
}
