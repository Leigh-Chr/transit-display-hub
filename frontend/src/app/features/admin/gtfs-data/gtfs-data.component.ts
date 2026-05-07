import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { BookingRule, FareAttribute, Translation } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gtfs-data-page">
      <div class="page-header">
        <h1 class="page-title">Données GTFS</h1>
        <p class="page-subtitle">
          Browse en lecture seule des tables annexes alimentées par
          l'import GTFS — tarifs, transport à la demande, traductions.
        </p>
      </div>

      <mat-tab-group animationDuration="0ms">
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">payments</mat-icon>
            Tarifs
            <span class="tab-count">{{ fares().length }}</span>
          </ng-template>

          <div class="tab-content">
            @if (fares().length === 0) {
              <app-empty-state
                icon="payments"
                title="Aucun tarif importé"
                description="Le feed GTFS courant ne contient pas de fare_attributes.txt, ou le fichier est vide." />
            } @else {
              <table mat-table [dataSource]="fares()" class="data-table">
                <ng-container matColumnDef="externalId">
                  <th mat-header-cell *matHeaderCellDef>fare_id</th>
                  <td mat-cell *matCellDef="let f"><code>{{ f.externalId || '—' }}</code></td>
                </ng-container>

                <ng-container matColumnDef="price">
                  <th mat-header-cell *matHeaderCellDef>Prix</th>
                  <td mat-cell *matCellDef="let f">
                    <strong>{{ f.price }}</strong> {{ f.currency }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="paymentMethod">
                  <th mat-header-cell *matHeaderCellDef>Paiement</th>
                  <td mat-cell *matCellDef="let f">{{ paymentLabel(f.paymentMethod) }}</td>
                </ng-container>

                <ng-container matColumnDef="transfers">
                  <th mat-header-cell *matHeaderCellDef>Correspondances</th>
                  <td mat-cell *matCellDef="let f">{{ transferLabel(f) }}</td>
                </ng-container>

                <ng-container matColumnDef="agency">
                  <th mat-header-cell *matHeaderCellDef>Agence</th>
                  <td mat-cell *matCellDef="let f">{{ f.agencyName || '—' }}</td>
                </ng-container>

                <ng-container matColumnDef="rules">
                  <th mat-header-cell *matHeaderCellDef>Règles</th>
                  <td mat-cell *matCellDef="let f">
                    <span [matTooltip]="ruleTooltip(f)">{{ f.rules.length }}</span>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="fareColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: fareColumns"></tr>
              </table>
            }
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">phone_callback</mat-icon>
            TAD
            <span class="tab-count">{{ bookingRules().length }}</span>
          </ng-template>

          <div class="tab-content">
            @if (bookingRules().length === 0) {
              <app-empty-state
                icon="phone_callback"
                title="Aucune règle de réservation"
                description="Le feed GTFS courant ne contient pas de booking_rules.txt — pas de transport à la demande." />
            } @else {
              <table mat-table [dataSource]="bookingRules()" class="data-table">
                <ng-container matColumnDef="externalId">
                  <th mat-header-cell *matHeaderCellDef>booking_rule_id</th>
                  <td mat-cell *matCellDef="let b"><code>{{ b.externalId || '—' }}</code></td>
                </ng-container>

                <ng-container matColumnDef="bookingType">
                  <th mat-header-cell *matHeaderCellDef>Type</th>
                  <td mat-cell *matCellDef="let b">{{ bookingTypeLabel(b.bookingType) }}</td>
                </ng-container>

                <ng-container matColumnDef="notice">
                  <th mat-header-cell *matHeaderCellDef>Préavis</th>
                  <td mat-cell *matCellDef="let b">{{ noticeLabel(b) }}</td>
                </ng-container>

                <ng-container matColumnDef="phone">
                  <th mat-header-cell *matHeaderCellDef>Téléphone</th>
                  <td mat-cell *matCellDef="let b">
                    @if (b.phone) {
                      <a [href]="'tel:' + b.phone">{{ b.phone }}</a>
                    } @else { — }
                  </td>
                </ng-container>

                <ng-container matColumnDef="bookingUrl">
                  <th mat-header-cell *matHeaderCellDef>Réservation</th>
                  <td mat-cell *matCellDef="let b">
                    @if (b.bookingUrl) {
                      <a [href]="b.bookingUrl" target="_blank" rel="noopener">
                        Lien <mat-icon class="inline-icon">open_in_new</mat-icon>
                      </a>
                    } @else { — }
                  </td>
                </ng-container>

                <ng-container matColumnDef="message">
                  <th mat-header-cell *matHeaderCellDef>Message</th>
                  <td mat-cell *matCellDef="let b" class="ellipsis">
                    <span [matTooltip]="b.message || ''">{{ b.message || '—' }}</span>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="bookingColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: bookingColumns"></tr>
              </table>
            }
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">translate</mat-icon>
            Traductions
            <span class="tab-count">{{ translations().length }}</span>
          </ng-template>

          <div class="tab-content">
            <div class="translation-toolbar">
              <mat-form-field appearance="outline" class="lang-field">
                <mat-label>Langue</mat-label>
                <mat-select [(ngModel)]="language" (selectionChange)="loadTranslations()">
                  @for (l of LANGUAGES; track l) {
                    <mat-option [value]="l">{{ l }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="table-field">
                <mat-label>Table (optionnel)</mat-label>
                <mat-select [(ngModel)]="tableFilter" (selectionChange)="loadTranslations()">
                  <mat-option [value]="''">Toutes</mat-option>
                  @for (t of TABLES; track t) {
                    <mat-option [value]="t">{{ t }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <button mat-stroked-button (click)="loadTranslations()" [disabled]="loadingTranslations()">
                <mat-icon>refresh</mat-icon>
                Recharger
              </button>
            </div>

            @if (translations().length === 0) {
              <app-empty-state
                icon="translate"
                title="Aucune traduction"
                description="Aucune ligne pour cette langue. Le feed contient peut-être seulement la langue par défaut." />
            } @else {
              <table mat-table [dataSource]="translations()" class="data-table">
                <ng-container matColumnDef="tableName">
                  <th mat-header-cell *matHeaderCellDef>Table</th>
                  <td mat-cell *matCellDef="let t"><code>{{ t.tableName }}</code></td>
                </ng-container>

                <ng-container matColumnDef="recordId">
                  <th mat-header-cell *matHeaderCellDef>record_id</th>
                  <td mat-cell *matCellDef="let t">{{ t.recordId || '—' }}</td>
                </ng-container>

                <ng-container matColumnDef="fieldName">
                  <th mat-header-cell *matHeaderCellDef>Champ</th>
                  <td mat-cell *matCellDef="let t"><code>{{ t.fieldName }}</code></td>
                </ng-container>

                <ng-container matColumnDef="fieldValue">
                  <th mat-header-cell *matHeaderCellDef>Source</th>
                  <td mat-cell *matCellDef="let t" class="ellipsis">
                    <span [matTooltip]="t.fieldValue || ''">{{ t.fieldValue || '—' }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="translation">
                  <th mat-header-cell *matHeaderCellDef>Traduction</th>
                  <td mat-cell *matCellDef="let t" class="ellipsis">
                    <span [matTooltip]="t.translation">{{ t.translation }}</span>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="translationColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: translationColumns"></tr>
              </table>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: `
    .gtfs-data-page { max-width: 1300px; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 4px 0; font-size: 1.6rem; font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }

    .tab-icon { margin-right: 6px; vertical-align: middle; }
    .tab-count {
      margin-left: 8px;
      font-size: 0.75rem;
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font-variant-numeric: tabular-nums;
    }

    .tab-content { padding: 16px 0; }

    .data-table {
      width: 100%;
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
      overflow: hidden;
    }
    .data-table td, .data-table th {
      font-variant-numeric: tabular-nums;
    }
    .data-table code {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.85em;
      padding: 1px 6px;
      background: var(--mat-sys-surface-container-high);
      border-radius: 4px;
    }
    .ellipsis {
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .translation-toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .lang-field { width: 140px; }
    .table-field { width: 200px; }

    .inline-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      vertical-align: middle;
    }
  `,
})
export class GtfsDataComponent implements OnInit {
  private readonly gtfsData = inject(GtfsDataService);

  readonly fares = signal<FareAttribute[]>([]);
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

  ngOnInit(): void {
    this.gtfsData.getFares().subscribe({
      next: (data) => this.fares.set(data),
      error: () => this.fares.set([]),
    });
    this.gtfsData.getBookingRules().subscribe({
      next: (data) => this.bookingRules.set(data),
      error: () => this.bookingRules.set([]),
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
      },
    });
  }

  paymentLabel(method: string | null): string {
    if (!method) {return '—';}
    return method === 'ON_BOARD' ? 'À bord' : 'À l\'avance';
  }

  transferLabel(f: FareAttribute): string {
    if (f.transfers === null) {return 'Illimitées';}
    if (f.transfers === 0) {return 'Aucune';}
    const dur = f.transferDuration ? ` (${Math.round(f.transferDuration / 60)} min)` : '';
    return `${f.transfers}${dur}`;
  }

  ruleTooltip(f: FareAttribute): string {
    if (f.rules.length === 0) {return 'Tarif unitaire sans condition';}
    return f.rules.map(r => {
      const parts: string[] = [];
      if (r.routeCode) {parts.push(`route=${r.routeCode}`);}
      if (r.originId) {parts.push(`origin=${r.originId}`);}
      if (r.destinationId) {parts.push(`dest=${r.destinationId}`);}
      if (r.containsId) {parts.push(`contains=${r.containsId}`);}
      return parts.join(', ') || 'tarif applicable';
    }).join('\n');
  }

  bookingTypeLabel(t: string): string {
    switch (t) {
      case 'REAL_TIME': return 'Temps réel';
      case 'SAME_DAY': return 'Jour même';
      case 'PRIOR_DAYS': return 'À l\'avance';
      default: return t;
    }
  }

  noticeLabel(b: BookingRule): string {
    if (b.priorNoticeDurationMin !== null && b.priorNoticeDurationMax !== null) {
      return `${b.priorNoticeDurationMin}–${b.priorNoticeDurationMax} min`;
    }
    if (b.priorNoticeDurationMin !== null) {
      return `≥ ${b.priorNoticeDurationMin} min`;
    }
    if (b.priorNoticeLastDay !== null) {
      const t = b.priorNoticeLastTime ? ` à ${b.priorNoticeLastTime.slice(0, 5)}` : '';
      return `J−${b.priorNoticeLastDay}${t}`;
    }
    return '—';
  }
}
