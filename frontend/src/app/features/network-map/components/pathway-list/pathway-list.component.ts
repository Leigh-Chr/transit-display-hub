import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

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

const MODE_LABEL: Record<PathwayMode, string> = {
  WALKWAY: 'Couloir',
  STAIRS: 'Escalier',
  MOVING_SIDEWALK: 'Tapis roulant',
  ESCALATOR: 'Escalator',
  ELEVATOR: 'Ascenseur',
  FARE_GATE: 'Portique',
  EXIT_GATE: 'Sortie',
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
      <div class="pathway-list" aria-label="Connexions internes de la station">
        <h3 class="section-title">
          <mat-icon>alt_route</mat-icon>
          Connexions internes — {{ graph()?.stationName }}
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
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }

    .section-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .levels-line {
      margin: 0 0 10px;
      font-size: 0.8rem;
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
      font-size: 20px;
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
      font-size: 0.85rem;
    }

    .row-meta {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.78rem;
    }

    .row-detail {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.78rem;
      font-style: italic;
    }

    .row-duration {
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }
  `,
})
export class PathwayListComponent {
  readonly graph = input<StationPathwayGraph | null>(null);

  readonly rows = computed<PathwayRow[]>(() => {
    const g = this.graph();
    if (!g) {return [];}
    return g.pathways.map(p => ({
      pathway: p,
      icon: MODE_ICON[p.pathwayMode] ?? 'alt_route',
      label: MODE_LABEL[p.pathwayMode] ?? 'Connexion',
      durationLabel: this.formatDuration(p.traversalTimeSeconds),
      detailLabel: this.detailFor(p),
    }));
  });

  readonly levelLine = computed<string | null>(() => {
    const g = this.graph();
    if (!g || g.levels.length === 0) {return null;}
    const labels = g.levels.map(l => l.name ?? `niveau ${l.index}`);
    return `${g.levels.length} niveau${g.levels.length > 1 ? 'x' : ''} : ${labels.join(', ')}`;
  });

  private formatDuration(seconds: number | null): string | null {
    if (seconds === null || seconds === undefined) {return null;}
    if (seconds < 60) {return `${seconds} s`;}
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  }

  private detailFor(p: Pathway): string | null {
    const parts: string[] = [];
    if (p.stairCount !== null && p.stairCount !== undefined && p.stairCount !== 0) {
      const dir = p.stairCount > 0 ? 'montée' : 'descente';
      parts.push(`${Math.abs(p.stairCount)} marches (${dir})`);
    }
    if (p.signpostedAs) {parts.push(`« ${p.signpostedAs} »`);}
    return parts.length > 0 ? parts.join(' · ') : null;
  }
}
