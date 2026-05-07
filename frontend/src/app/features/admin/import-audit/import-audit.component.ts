import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { ImportAudit, ImportStatus } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

/**
 * Timeline of GTFS import attempts. Each row exposes status,
 * duration, entity counts and (for FAILED) the error message.
 *
 * Hash + URL columns make the SKIPPED_UNCHANGED outcome auditable —
 * "did the importer correctly identify the feed as unchanged?".
 */
@Component({
  selector: 'app-import-audit',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatExpansionModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="audit-page">
      <div class="page-header">
        <h1 class="page-title">Historique des imports</h1>
        <p class="page-subtitle">
          Tentatives d'import GTFS — succès, skip pour feed inchangé,
          échecs avec leur message. Le scheduler boot-time et les
          import-now manuels écrivent ici.
        </p>
      </div>

      <div class="toolbar">
        <button mat-stroked-button (click)="reload()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          Rafraîchir
        </button>
        @if (audits().length > 0) {
          <span class="muted">{{ audits().length }} tentative(s)</span>
        }
      </div>

      @if (audits().length === 0) {
        <app-empty-state
          icon="history"
          title="Pas encore d'import enregistré"
          description="Configure app.gtfs.feed-url et déclenche un import depuis l'écran admin." />
      } @else {
        <div class="audit-table-wrapper">
          <table mat-table [dataSource]="audits()" class="audit-table">
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Statut</th>
              <td mat-cell *matCellDef="let a">
                <mat-icon [class]="'status-icon ' + statusClass(a.status)" [matTooltip]="statusLabel(a.status)">
                  {{ statusIcon(a.status) }}
                </mat-icon>
              </td>
            </ng-container>

            <ng-container matColumnDef="startedAt">
              <th mat-header-cell *matHeaderCellDef>Démarré</th>
              <td mat-cell *matCellDef="let a">
                <div>{{ a.startedAt | date:'dd/MM HH:mm:ss' }}</div>
                @if (a.triggeredBy) {
                  <div class="muted">par {{ a.triggeredBy }}</div>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="duration">
              <th mat-header-cell *matHeaderCellDef>Durée</th>
              <td mat-cell *matCellDef="let a">
                @if (a.durationMs !== null) {
                  {{ formatDuration(a.durationMs) }}
                } @else {
                  <span class="muted">en cours…</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="counts">
              <th mat-header-cell *matHeaderCellDef>Volumétrie</th>
              <td mat-cell *matCellDef="let a">
                @if (a.status === 'SUCCESS') {
                  <span class="counts">
                    <span [matTooltip]="'lignes'">
                      <mat-icon class="inline-icon">subway</mat-icon>
                      {{ a.linesCount ?? 0 }}
                    </span>
                    <span [matTooltip]="'arrêts'">
                      <mat-icon class="inline-icon">place</mat-icon>
                      {{ a.stopsCount ?? 0 }}
                    </span>
                    <span [matTooltip]="'itinéraires'">
                      <mat-icon class="inline-icon">route</mat-icon>
                      {{ a.itinerariesCount ?? 0 }}
                    </span>
                    <span [matTooltip]="'horaires'">
                      <mat-icon class="inline-icon">schedule</mat-icon>
                      {{ formatLarge(a.schedulesCount ?? 0) }}
                    </span>
                  </span>
                } @else {
                  <span class="muted">—</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="hash">
              <th mat-header-cell *matHeaderCellDef>Hash</th>
              <td mat-cell *matCellDef="let a">
                @if (a.sourceHash) {
                  <code class="hash" [matTooltip]="a.sourceHash">{{ a.sourceHash.slice(0, 8) }}</code>
                } @else { — }
              </td>
            </ng-container>

            <ng-container matColumnDef="error">
              <th mat-header-cell *matHeaderCellDef>Erreur</th>
              <td mat-cell *matCellDef="let a" class="ellipsis">
                @if (a.errorMessage) {
                  <span class="error" [matTooltip]="a.errorMessage">{{ a.errorMessage }}</span>
                } @else { — }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns" [class]="rowClass(row)"></tr>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .audit-page { max-width: 1300px; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 4px 0; font-size: 1.6rem; font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .muted { color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; }

    .audit-table-wrapper {
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
      overflow-x: auto;
    }
    .audit-table { width: 100%; }
    .audit-table td, .audit-table th {
      font-variant-numeric: tabular-nums;
    }

    .status-icon { font-size: 22px; width: 22px; height: 22px; }
    .status-icon.success { color: rgb(46, 174, 96); }
    .status-icon.skipped { color: var(--mat-sys-outline); }
    .status-icon.failed { color: rgb(220, 38, 38); }
    .status-icon.running { color: rgb(241, 158, 11); }

    .counts {
      display: inline-flex;
      gap: 14px;
      align-items: center;
    }
    .inline-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      vertical-align: middle;
      color: var(--mat-sys-on-surface-variant);
      margin-right: 2px;
    }

    .hash {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.85em;
      padding: 1px 6px;
      background: var(--mat-sys-surface-container-high);
      border-radius: 4px;
    }

    .ellipsis {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .error { color: rgb(220, 38, 38); }

    tr.row-failed {
      background: rgba(220, 38, 38, 0.05);
    }
    tr.row-running {
      background: rgba(241, 158, 11, 0.05);
    }
  `,
})
export class ImportAuditComponent implements OnInit {
  private readonly gtfsData = inject(GtfsDataService);

  readonly audits = signal<ImportAudit[]>([]);
  readonly loading = signal(false);

  readonly columns = ['status', 'startedAt', 'duration', 'counts', 'hash', 'error'];

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.gtfsData.getImportAudit(50).subscribe({
      next: (data) => {
        this.audits.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.audits.set([]);
        this.loading.set(false);
      },
    });
  }

  statusIcon(status: ImportStatus): string {
    switch (status) {
      case 'SUCCESS': return 'check_circle';
      case 'SKIPPED_UNCHANGED': return 'remove_circle_outline';
      case 'FAILED': return 'error';
      case 'RUNNING': return 'sync';
    }
  }

  statusClass(status: ImportStatus): string {
    switch (status) {
      case 'SUCCESS': return 'success';
      case 'SKIPPED_UNCHANGED': return 'skipped';
      case 'FAILED': return 'failed';
      case 'RUNNING': return 'running';
    }
  }

  statusLabel(status: ImportStatus): string {
    switch (status) {
      case 'SUCCESS': return 'Succès';
      case 'SKIPPED_UNCHANGED': return 'Sauté (feed inchangé)';
      case 'FAILED': return 'Échec';
      case 'RUNNING': return 'En cours';
    }
  }

  rowClass(audit: ImportAudit): string {
    if (audit.status === 'FAILED') {return 'row-failed';}
    if (audit.status === 'RUNNING') {return 'row-running';}
    return '';
  }

  formatDuration(ms: number): string {
    if (ms < 1000) {return `${ms} ms`;}
    if (ms < 60_000) {return `${(ms / 1000).toFixed(1)} s`;}
    const min = Math.floor(ms / 60_000);
    const sec = Math.round((ms % 60_000) / 1000);
    return `${min} min ${sec} s`;
  }

  formatLarge(value: number): string {
    if (value < 10_000) {return value.toLocaleString('fr-FR');}
    return (value / 1000).toFixed(1).replace('.', ',') + 'k';
  }
}
