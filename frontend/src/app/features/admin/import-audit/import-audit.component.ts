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
import { LocaleService } from '@core/i18n/locale.service';
import { ImportAudit, ImportStatus } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { httpErrorMessage } from '@shared/utils/http.utils';
import { bcp47 } from '@shared/utils/locale-date.utils';

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
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <div class="audit-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.importAudit.title') }}</h1>
        <p class="page-subtitle">{{ t('admin.importAudit.subtitle') }}</p>
      </div>

      <div class="toolbar">
        <button mat-stroked-button (click)="reload()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          {{ t('admin.importAudit.refresh') }}
        </button>
        @if (audits().length > 0) {
          <span class="muted">{{ audits().length }} {{ t('admin.importAudit.attempts') }}</span>
        }
      </div>

      @if (loadError()) {
        <app-empty-state
          icon="error_outline"
          [title]="t('admin.importAudit.loadFailed')"
          [description]="t('admin.common.loadErrorDescription')"
          [actionLabel]="t('common.refresh')"
          actionIcon="refresh"
          (action)="reload()" />
      } @else if (audits().length === 0) {
        <app-empty-state
          icon="history"
          [title]="t('admin.importAudit.noAudits')"
          [description]="t('admin.importAudit.noAuditsDesc')" />
      } @else {
        <div class="audit-table-wrapper">
          <table mat-table [dataSource]="audits()" class="audit-table">
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.importAudit.colStatus') }}</th>
              <td mat-cell *matCellDef="let a">
                <mat-icon [class]="'status-icon ' + statusClass(a.status)" [matTooltip]="statusLabel(a.status, t)">
                  {{ statusIcon(a.status) }}
                </mat-icon>
              </td>
            </ng-container>

            <ng-container matColumnDef="startedAt">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.importAudit.colStarted') }}</th>
              <td mat-cell *matCellDef="let a">
                <div>{{ a.startedAt | date:'dd/MM HH:mm:ss' }}</div>
                @if (a.triggeredBy) {
                  <div class="muted">par {{ a.triggeredBy }}</div>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="duration">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.importAudit.colDuration') }}</th>
              <td mat-cell *matCellDef="let a">
                @if (a.durationMs !== null) {
                  {{ formatDuration(a.durationMs) }}
                } @else {
                  <span class="muted">{{ t('admin.importAudit.running') }}</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="counts">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.importAudit.colVolume') }}</th>
              <td mat-cell *matCellDef="let a">
                @if (a.status === 'SUCCESS') {
                  <span class="counts">
                    <span [matTooltip]="t('admin.navigation.lines')">
                      <mat-icon class="inline-icon">subway</mat-icon>
                      {{ a.linesCount ?? 0 }}
                    </span>
                    <span [matTooltip]="t('admin.navigation.stops')">
                      <mat-icon class="inline-icon">place</mat-icon>
                      {{ a.stopsCount ?? 0 }}
                    </span>
                    <span [matTooltip]="t('admin.navigation.itineraries')">
                      <mat-icon class="inline-icon">route</mat-icon>
                      {{ a.itinerariesCount ?? 0 }}
                    </span>
                    <span [matTooltip]="t('admin.navigation.schedules')">
                      <mat-icon class="inline-icon">schedule</mat-icon>
                      {{ formatLarge(a.schedulesCount ?? 0) }}
                    </span>
                  </span>
                } @else {
                  <span class="muted">—</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="validation">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.importAudit.colValidation') }}</th>
              <td mat-cell *matCellDef="let a">
                @if (!a.validationStatus || a.validationStatus === 'SKIPPED') {
                  <span class="muted" [matTooltip]="t('admin.importAudit.validationNotRun')">—</span>
                } @else if (a.validationStatus === 'FAILED') {
                  <span class="validation-badge failed" [matTooltip]="t('admin.importAudit.validationFailed')">
                    <mat-icon class="inline-icon">error_outline</mat-icon>
                    {{ t('admin.importAudit.validationFailedLabel') }}
                  </span>
                } @else {
                  <div class="validation-row">
                    <span class="validation-counts" [matTooltip]="validationCountsTooltip(a, t)">
                      @if ((a.validationNoticeErrors ?? 0) > 0) {
                        <span class="badge errors">
                          <mat-icon class="inline-icon">error</mat-icon>
                          {{ a.validationNoticeErrors }}
                        </span>
                      }
                      @if ((a.validationNoticeWarnings ?? 0) > 0) {
                        <span class="badge warnings">
                          <mat-icon class="inline-icon">warning</mat-icon>
                          {{ a.validationNoticeWarnings }}
                        </span>
                      }
                      @if ((a.validationNoticeErrors ?? 0) === 0 && (a.validationNoticeWarnings ?? 0) === 0) {
                        <span class="badge clean">
                          <mat-icon class="inline-icon">verified</mat-icon>
                          {{ t('admin.importAudit.noValidationNotices') }}
                        </span>
                      }
                    </span>
                    <a mat-icon-button class="report-link"
                       [href]="reportHtmlUrl(a.id)"
                       target="_blank" rel="noopener noreferrer"
                       [matTooltip]="t('admin.importAudit.openReport')">
                      <mat-icon>open_in_new</mat-icon>
                    </a>
                  </div>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="hash">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.importAudit.colHash') }}</th>
              <td mat-cell *matCellDef="let a">
                @if (a.sourceHash) {
                  <code class="hash" [matTooltip]="a.sourceHash">{{ a.sourceHash.slice(0, 8) }}</code>
                } @else { — }
              </td>
            </ng-container>

            <ng-container matColumnDef="error">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.importAudit.colError') }}</th>
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
    </ng-container>
  `,
  styles: `
    .audit-page { max-width: 1300px; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 4px 0; font-size: var(--m3-type-headline-medium); font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .muted { color: var(--mat-sys-on-surface-variant); font-size: var(--m3-type-body-medium); }

    .audit-table-wrapper {
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
      overflow-x: auto;
    }
    .audit-table { width: 100%; }
    .audit-table td, .audit-table th {
      font-variant-numeric: tabular-nums;
    }

    .status-icon { font-size: var(--m3-type-headline-small); width: 22px; height: 22px; }
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
      font-size: var(--m3-type-body-medium);
      width: 14px;
      height: 14px;
      vertical-align: middle;
      color: var(--mat-sys-on-surface-variant);
      margin-right: 2px;
    }

    .hash {
      font-family: monospace;
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

    .validation-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .validation-counts {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: var(--m3-type-body-medium);
      font-weight: 500;
    }
    .badge.errors {
      background: rgba(220, 38, 38, 0.12);
      color: rgb(220, 38, 38);
    }
    .badge.warnings {
      background: rgba(241, 158, 11, 0.16);
      color: rgb(180, 134, 6);
    }
    .badge.clean {
      background: rgba(46, 174, 96, 0.12);
      color: rgb(46, 174, 96);
    }
    .validation-badge.failed {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: rgb(220, 38, 38);
      font-size: var(--m3-type-body-medium);
    }
    .report-link {
      width: 32px;
      height: 32px;
    }
  `,
})
export class ImportAuditComponent implements OnInit {
  private readonly gtfsData = inject(GtfsDataService);
  private readonly locale = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);

  readonly audits = signal<ImportAudit[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly columns = ['status', 'startedAt', 'duration', 'counts', 'validation', 'hash', 'error'];

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.gtfsData.getImportAudit(50).subscribe({
      next: (data) => {
        this.audits.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.audits.set([]);
        this.loading.set(false);
        this.loadError.set(httpErrorMessage(err, this.transloco.translate('admin.importAudit.loadFailed')));
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

  statusLabel(status: ImportStatus, t: (key: string) => string): string {
    switch (status) {
      case 'SUCCESS': return t('admin.importAudit.status.success');
      case 'SKIPPED_UNCHANGED': return t('admin.importAudit.status.skipped');
      case 'FAILED': return t('admin.importAudit.status.failed');
      case 'RUNNING': return t('admin.importAudit.status.running');
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
    const tag = bcp47(this.locale.current());
    if (value < 10_000) {return value.toLocaleString(tag);}
    return (value / 1000).toLocaleString(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k';
  }

  reportHtmlUrl(auditId: string): string {
    return `/api/admin/import-audit/${auditId}/validation-report.html`;
  }

  validationCountsTooltip(audit: ImportAudit, t: (key: string, params?: Record<string, unknown>) => string): string {
    const errors = audit.validationNoticeErrors ?? 0;
    const warnings = audit.validationNoticeWarnings ?? 0;
    if (errors === 0 && warnings === 0) {
      return t('admin.importAudit.validationClean');
    }
    return t('admin.importAudit.validationSummary', { errors, warnings });
  }
}
