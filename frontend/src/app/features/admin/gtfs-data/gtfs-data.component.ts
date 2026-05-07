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
import { BookingRule, FareAttribute, FaresV2, Translation } from '@shared/models';
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
            <mat-icon class="tab-icon">confirmation_number</mat-icon>
            Fares v2
            @if (faresV2(); as fv2) {
              <span class="tab-count">{{ fv2.products.length }}</span>
            }
          </ng-template>

          <div class="tab-content">
            @if (faresV2(); as fv2) {
              @if (fv2.products.length === 0 && fv2.areas.length === 0) {
                <app-empty-state
                  icon="confirmation_number"
                  title="Pas de Fares v2"
                  description="Le feed n'a pas de fare_products.txt / areas.txt. La page Tarifs affiche la v1 si elle est présente." />
              } @else {
                @if (fv2.networks.length > 0) {
                  <h3 class="section-title">Réseaux ({{ fv2.networks.length }})</h3>
                  <table mat-table [dataSource]="fv2.networks" class="data-table">
                    <ng-container matColumnDef="externalId">
                      <th mat-header-cell *matHeaderCellDef>network_id</th>
                      <td mat-cell *matCellDef="let n"><code>{{ n.externalId }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Nom</th>
                      <td mat-cell *matCellDef="let n">{{ n.name || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="routeCount">
                      <th mat-header-cell *matHeaderCellDef>Lignes</th>
                      <td mat-cell *matCellDef="let n">{{ n.routeCount }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2NetworkColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2NetworkColumns"></tr>
                  </table>
                }

                @if (fv2.fareMedia.length > 0) {
                  <h3 class="section-title">Supports ({{ fv2.fareMedia.length }})</h3>
                  <table mat-table [dataSource]="fv2.fareMedia" class="data-table">
                    <ng-container matColumnDef="externalId">
                      <th mat-header-cell *matHeaderCellDef>fare_media_id</th>
                      <td mat-cell *matCellDef="let m"><code>{{ m.externalId }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Nom</th>
                      <td mat-cell *matCellDef="let m">{{ m.name || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="mediaType">
                      <th mat-header-cell *matHeaderCellDef>Type</th>
                      <td mat-cell *matCellDef="let m">{{ mediaTypeLabel(m.mediaType) }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2MediaColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2MediaColumns"></tr>
                  </table>
                }

                @if (fv2.products.length > 0) {
                  <h3 class="section-title">Produits ({{ fv2.products.length }})</h3>
                  <table mat-table [dataSource]="fv2.products" class="data-table">
                    <ng-container matColumnDef="externalId">
                      <th mat-header-cell *matHeaderCellDef>fare_product_id</th>
                      <td mat-cell *matCellDef="let p"><code>{{ p.externalId }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Nom</th>
                      <td mat-cell *matCellDef="let p">{{ p.name || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="amount">
                      <th mat-header-cell *matHeaderCellDef>Prix</th>
                      <td mat-cell *matCellDef="let p"><strong>{{ p.amount }}</strong> {{ p.currency }}</td>
                    </ng-container>
                    <ng-container matColumnDef="media">
                      <th mat-header-cell *matHeaderCellDef>Support</th>
                      <td mat-cell *matCellDef="let p">{{ p.fareMediaId || '—' }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2ProductColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2ProductColumns"></tr>
                  </table>
                }

                @if (fv2.areas.length > 0) {
                  <h3 class="section-title">Zones ({{ fv2.areas.length }})</h3>
                  <table mat-table [dataSource]="fv2.areas" class="data-table">
                    <ng-container matColumnDef="externalId">
                      <th mat-header-cell *matHeaderCellDef>area_id</th>
                      <td mat-cell *matCellDef="let a"><code>{{ a.externalId }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Nom</th>
                      <td mat-cell *matCellDef="let a">{{ a.name || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="stopCount">
                      <th mat-header-cell *matHeaderCellDef>Arrêts</th>
                      <td mat-cell *matCellDef="let a">{{ a.stopCount }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2AreaColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2AreaColumns"></tr>
                  </table>
                }

                @if (fv2.legRules.length > 0) {
                  <h3 class="section-title">Leg rules ({{ fv2.legRules.length }})</h3>
                  <table mat-table [dataSource]="fv2.legRules" class="data-table">
                    <ng-container matColumnDef="legGroup">
                      <th mat-header-cell *matHeaderCellDef>leg_group</th>
                      <td mat-cell *matCellDef="let r"><code>{{ r.legGroupId || '—' }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="from">
                      <th mat-header-cell *matHeaderCellDef>De</th>
                      <td mat-cell *matCellDef="let r">{{ r.fromAreaName || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="to">
                      <th mat-header-cell *matHeaderCellDef>Vers</th>
                      <td mat-cell *matCellDef="let r">{{ r.toAreaName || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="window">
                      <th mat-header-cell *matHeaderCellDef>Fenêtre</th>
                      <td mat-cell *matCellDef="let r">{{ r.fromTimeframeGroupId || r.toTimeframeGroupId || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="product">
                      <th mat-header-cell *matHeaderCellDef>Produit</th>
                      <td mat-cell *matCellDef="let r">
                        @if (r.productExternalId) {
                          <code>{{ r.productExternalId }}</code>
                          @if (r.productAmount) {
                            <span class="muted">— {{ r.productAmount }} {{ r.productCurrency }}</span>
                          }
                        } @else { — }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="priority">
                      <th mat-header-cell *matHeaderCellDef>Priorité</th>
                      <td mat-cell *matCellDef="let r">{{ r.rulePriority ?? '—' }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2LegColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2LegColumns"></tr>
                  </table>
                }

                @if (fv2.transferRules.length > 0) {
                  <h3 class="section-title">Transfer rules ({{ fv2.transferRules.length }})</h3>
                  <table mat-table [dataSource]="fv2.transferRules" class="data-table">
                    <ng-container matColumnDef="from">
                      <th mat-header-cell *matHeaderCellDef>Depuis</th>
                      <td mat-cell *matCellDef="let r"><code>{{ r.fromLegGroupId || '—' }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="to">
                      <th mat-header-cell *matHeaderCellDef>Vers</th>
                      <td mat-cell *matCellDef="let r"><code>{{ r.toLegGroupId || '—' }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="duration">
                      <th mat-header-cell *matHeaderCellDef>Validité</th>
                      <td mat-cell *matCellDef="let r">
                        @if (r.durationLimit) {
                          {{ r.durationLimit / 60 | number:'1.0-0' }} min
                        } @else { — }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="type">
                      <th mat-header-cell *matHeaderCellDef>Type</th>
                      <td mat-cell *matCellDef="let r">{{ transferTypeLabel(r.fareTransferType) }}</td>
                    </ng-container>
                    <ng-container matColumnDef="product">
                      <th mat-header-cell *matHeaderCellDef>Produit</th>
                      <td mat-cell *matCellDef="let r">
                        @if (r.productExternalId) {
                          <code>{{ r.productExternalId }}</code>
                          @if (r.productAmount) {
                            <span class="muted">— {{ r.productAmount }} {{ r.productCurrency }}</span>
                          }
                        } @else { — }
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2TransferColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2TransferColumns"></tr>
                  </table>
                }
              }
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

    .section-title {
      margin: 24px 0 12px 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .section-title:first-of-type { margin-top: 0; }
    .muted { color: var(--mat-sys-on-surface-variant); margin-left: 4px; font-size: 0.85em; }
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

  ngOnInit(): void {
    this.gtfsData.getFares().subscribe({
      next: (data) => this.fares.set(data),
      error: () => this.fares.set([]),
    });
    this.gtfsData.getBookingRules().subscribe({
      next: (data) => this.bookingRules.set(data),
      error: () => this.bookingRules.set([]),
    });
    this.gtfsData.getFaresV2().subscribe({
      next: (data) => this.faresV2.set(data),
      error: () => this.faresV2.set(null),
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

  transferTypeLabel(t: number): string {
    switch (t) {
      case 0: return 'A + transfer combinés';
      case 1: return 'A puis transfer séparé';
      case 2: return 'Transfer remplace A';
      default: return `Type ${t}`;
    }
  }

  mediaTypeLabel(t: number | null): string {
    switch (t) {
      case 0: return 'Aucun';
      case 1: return 'Papier';
      case 2: return 'Carte transport';
      case 3: return 'Sans contact (EMV)';
      case 4: return 'Mobile';
      default: return t === null ? '—' : `Type ${t}`;
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
