import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { NotifyService } from '@core/services/notify.service';
import { BookingRule, FareAttribute, FaresV2, Translation } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

/**
 * One-stop browser for the GTFS extension tables — fares, booking
 * rules, translations — that the importer persists but the existing
 * admin CRUD doesn't surface. Read-only: these tables are populated
 * by the GTFS feed and don't have a "create" path in the UI.
 *
 * Translations require picking a target language (the importer can
 * carry rows for many at once); we default to "fr" because the
 * project's primary kiosk audience is French-speaking, with a quick
 * preset list for the next-most-common languages.
 */
@Component({
  selector: 'app-gtfs-data',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatTableModule,
    MatTooltipModule,
    EmptyStateComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gtfs-data.component.html',
  styleUrl: './gtfs-data.component.scss',
})
export class GtfsDataComponent implements OnInit {
  private readonly gtfsData = inject(GtfsDataService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  readonly fares = signal<FareAttribute[]>([]);
  readonly faresV2 = signal<FaresV2 | null>(null);
  readonly bookingRules = signal<BookingRule[]>([]);
  readonly translations = signal<Translation[]>([]);
  readonly loadingTranslations = signal(false);

  language = 'fr';
  tableFilter = '';

  readonly LANGUAGES = ['fr', 'en', 'de', 'es', 'it', 'nl'];
  readonly TABLES = ['stops', 'routes', 'trips', 'agency'];

  readonly fareColumns = ['externalId', 'price', 'paymentMethod', 'transfers', 'agency', 'rules'];
  readonly bookingColumns = ['externalId', 'bookingType', 'notice', 'phone', 'bookingUrl', 'message'];
  readonly translationColumns = ['tableName', 'recordId', 'fieldName', 'fieldValue', 'translation'];
  readonly v2ProductColumns = ['externalId', 'name', 'amount', 'media'];
  readonly v2AreaColumns = ['externalId', 'name', 'stopCount'];
  readonly v2LegColumns = ['legGroup', 'from', 'to', 'window', 'product', 'priority'];
  readonly v2TransferColumns = ['from', 'to', 'duration', 'type', 'product'];
  readonly v2NetworkColumns = ['externalId', 'name', 'routeCount'];
  readonly v2MediaColumns = ['externalId', 'name', 'mediaType'];
  readonly v2LegJoinColumns = ['fromNetwork', 'toNetwork', 'fromStop', 'toStop'];

  ngOnInit(): void {
    this.gtfsData.getFares().subscribe({
      next: (data) => this.fares.set(data),
      error: () => {
        this.fares.set([]);
        this.notify.error(this.transloco.translate('admin.gtfsData.loadFaresFailed'));
      },
    });
    this.gtfsData.getBookingRules().subscribe({
      next: (data) => this.bookingRules.set(data),
      error: () => {
        this.bookingRules.set([]);
        this.notify.error(this.transloco.translate('admin.gtfsData.loadBookingRulesFailed'));
      },
    });
    this.gtfsData.getFaresV2().subscribe({
      next: (data) => this.faresV2.set(data),
      error: () => {
        this.faresV2.set(null);
        this.notify.error(this.transloco.translate('admin.gtfsData.loadFaresV2Failed'));
      },
    });
    this.loadTranslations();
  }

  loadTranslations(): void {
    this.loadingTranslations.set(true);
    this.gtfsData.getTranslations(this.language, this.tableFilter || undefined).subscribe({
      next: (data) => {
        this.translations.set(data);
        this.loadingTranslations.set(false);
      },
      error: () => {
        this.translations.set([]);
        this.loadingTranslations.set(false);
        this.notify.error(this.transloco.translate('admin.gtfsData.loadTranslationsFailed'));
      },
    });
  }

  paymentLabel(method: string | null): string {
    if (!method) {return '—';}
    return this.transloco.translate(
      method === 'ON_BOARD' ? 'admin.gtfsData.payment.onBoard' : 'admin.gtfsData.payment.advance');
  }

  transferLabel(f: FareAttribute): string {
    if (f.transfers === null) {return this.transloco.translate('admin.gtfsData.transfer.unlimited');}
    if (f.transfers === 0) {return this.transloco.translate('admin.gtfsData.transfer.none');}
    const dur = f.transferDuration
      ? ` (${this.transloco.translate('admin.gtfsData.transfer.duration', {
          minutes: Math.round(f.transferDuration / 60),
        })})`
      : '';
    return `${f.transfers}${dur}`;
  }

  ruleTooltip(f: FareAttribute): string {
    if (f.rules.length === 0) {return this.transloco.translate('admin.gtfsData.rule.unconditional');}
    return f.rules.map(r => {
      const parts: string[] = [];
      if (r.routeCode) {parts.push(`route=${r.routeCode}`);}
      if (r.originId) {parts.push(`origin=${r.originId}`);}
      if (r.destinationId) {parts.push(`dest=${r.destinationId}`);}
      if (r.containsId) {parts.push(`contains=${r.containsId}`);}
      return parts.join(', ') || this.transloco.translate('admin.gtfsData.rule.fallback');
    }).join('\n');
  }

  bookingTypeLabel(t: string): string {
    const key = `admin.gtfsData.bookingType.${t}`;
    const translated = this.transloco.translate(key);
    return translated === key ? t : translated;
  }

  transferTypeLabel(t: number): string {
    const key = `admin.gtfsData.transferType.${t}`;
    const translated = this.transloco.translate(key);
    return translated === key
      ? this.transloco.translate('admin.gtfsData.transferType.unknown', { type: t })
      : translated;
  }

  mediaTypeLabel(t: number | null): string {
    if (t === null) {return '—';}
    const key = `admin.gtfsData.mediaType.${t}`;
    const translated = this.transloco.translate(key);
    return translated === key
      ? this.transloco.translate('admin.gtfsData.mediaType.unknown', { type: t })
      : translated;
  }

  noticeLabel(b: BookingRule): string {
    if (b.priorNoticeDurationMin !== null && b.priorNoticeDurationMax !== null) {
      return this.transloco.translate('admin.gtfsData.notice.range', {
        min: b.priorNoticeDurationMin,
        max: b.priorNoticeDurationMax,
      });
    }
    if (b.priorNoticeDurationMin !== null) {
      return this.transloco.translate('admin.gtfsData.notice.minOnly', {
        min: b.priorNoticeDurationMin,
      });
    }
    if (b.priorNoticeLastDay !== null) {
      const tm = b.priorNoticeLastTime
        ? this.transloco.translate('admin.gtfsData.notice.lastDayWithTime', {
            day: b.priorNoticeLastDay, time: b.priorNoticeLastTime.slice(0, 5),
          })
        : this.transloco.translate('admin.gtfsData.notice.lastDay', {
            day: b.priorNoticeLastDay,
          });
      return tm;
    }
    return '—';
  }
}
