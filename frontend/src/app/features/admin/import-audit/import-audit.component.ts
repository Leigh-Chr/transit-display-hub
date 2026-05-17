import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
import { createSimpleListResource } from '@shared/admin/simple-list-resource';
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
  templateUrl: './import-audit.component.html',
  styleUrl: './import-audit.component.scss',
})
export class ImportAuditComponent {
  private readonly gtfsData = inject(GtfsDataService);
  private readonly locale = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);

  private readonly auditsResource = createSimpleListResource<ImportAudit>(() =>
    this.gtfsData.getImportAudit(50),
  );
  readonly audits = this.auditsResource.items;
  readonly loading = this.auditsResource.loading;
  readonly loadError = computed(() => {
    const err = this.auditsResource.error();
    return err ? httpErrorMessage(err, this.transloco.translate('admin.importAudit.loadFailed')) : null;
  });

  readonly columns = ['status', 'startedAt', 'duration', 'counts', 'validation', 'hash', 'error'];

  reload(): void {
    this.auditsResource.reload();
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
