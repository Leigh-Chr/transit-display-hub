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
  template: `
    <ng-container *transloco="let t">
    <div class="gtfs-data-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.gtfsData.title') }}</h1>
        <p class="page-subtitle">{{ t('admin.gtfsData.subtitle') }}</p>
      </div>

      <mat-tab-group animationDuration="0ms">
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">payments</mat-icon>
            {{ t('admin.gtfsData.tabFares') }}
            <span class="tab-count">{{ fares().length }}</span>
          </ng-template>

          <div class="tab-content">
            @if (fares().length === 0) {
              <app-empty-state
                icon="payments"
                [title]="t('admin.gtfsData.noFares')"
                [description]="t('admin.gtfsData.noFaresDesc')" />
            } @else {
              <table mat-table [dataSource]="fares()" class="data-table">
                <ng-container matColumnDef="externalId">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colFareId') }}</th>
                  <td mat-cell *matCellDef="let f"><code>{{ f.externalId || '—' }}</code></td>
                </ng-container>

                <ng-container matColumnDef="price">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colPrice') }}</th>
                  <td mat-cell *matCellDef="let f">
                    <strong>{{ f.price }}</strong> {{ f.currency }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="paymentMethod">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colPayment') }}</th>
                  <td mat-cell *matCellDef="let f">{{ paymentLabel(f.paymentMethod) }}</td>
                </ng-container>

                <ng-container matColumnDef="transfers">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colTransfers') }}</th>
                  <td mat-cell *matCellDef="let f">{{ transferLabel(f) }}</td>
                </ng-container>

                <ng-container matColumnDef="agency">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colAgency') }}</th>
                  <td mat-cell *matCellDef="let f">{{ f.agencyName || '—' }}</td>
                </ng-container>

                <ng-container matColumnDef="rules">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colRules') }}</th>
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
            {{ t('admin.gtfsData.tabFaresV2') }}
            @if (faresV2(); as fv2) {
              <span class="tab-count">{{ fv2.products.length }}</span>
            }
          </ng-template>

          <div class="tab-content">
            @if (faresV2(); as fv2) {
              @if (fv2.products.length === 0 && fv2.areas.length === 0) {
                <app-empty-state
                  icon="confirmation_number"
                  [title]="t('admin.gtfsData.noFaresV2')"
                  [description]="t('admin.gtfsData.noFaresV2Desc')" />
              } @else {
                @if (fv2.networks.length > 0) {
                  <h3 class="section-title">{{ t('admin.gtfsData.sectionNetworks') }} ({{ fv2.networks.length }})</h3>
                  <table mat-table [dataSource]="fv2.networks" class="data-table">
                    <ng-container matColumnDef="externalId">
                      <th mat-header-cell *matHeaderCellDef>network_id</th>
                      <td mat-cell *matCellDef="let n"><code>{{ n.externalId }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colName') }}</th>
                      <td mat-cell *matCellDef="let n">{{ n.name || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="routeCount">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colRouteCount') }}</th>
                      <td mat-cell *matCellDef="let n">{{ n.routeCount }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2NetworkColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2NetworkColumns"></tr>
                  </table>
                }

                @if (fv2.fareMedia.length > 0) {
                  <h3 class="section-title">{{ t('admin.gtfsData.sectionMedia') }} ({{ fv2.fareMedia.length }})</h3>
                  <table mat-table [dataSource]="fv2.fareMedia" class="data-table">
                    <ng-container matColumnDef="externalId">
                      <th mat-header-cell *matHeaderCellDef>fare_media_id</th>
                      <td mat-cell *matCellDef="let m"><code>{{ m.externalId }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colName') }}</th>
                      <td mat-cell *matCellDef="let m">{{ m.name || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="mediaType">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colMediaType') }}</th>
                      <td mat-cell *matCellDef="let m">{{ mediaTypeLabel(m.mediaType) }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2MediaColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2MediaColumns"></tr>
                  </table>
                }

                @if (fv2.products.length > 0) {
                  <h3 class="section-title">{{ t('admin.gtfsData.sectionProducts') }} ({{ fv2.products.length }})</h3>
                  <table mat-table [dataSource]="fv2.products" class="data-table">
                    <ng-container matColumnDef="externalId">
                      <th mat-header-cell *matHeaderCellDef>fare_product_id</th>
                      <td mat-cell *matCellDef="let p"><code>{{ p.externalId }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colName') }}</th>
                      <td mat-cell *matCellDef="let p">{{ p.name || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="amount">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colAmount') }}</th>
                      <td mat-cell *matCellDef="let p"><strong>{{ p.amount }}</strong> {{ p.currency }}</td>
                    </ng-container>
                    <ng-container matColumnDef="media">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colMedia') }}</th>
                      <td mat-cell *matCellDef="let p">{{ p.fareMediaId || '—' }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2ProductColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2ProductColumns"></tr>
                  </table>
                }

                @if (fv2.areas.length > 0) {
                  <h3 class="section-title">{{ t('admin.gtfsData.sectionAreas') }} ({{ fv2.areas.length }})</h3>
                  <table mat-table [dataSource]="fv2.areas" class="data-table">
                    <ng-container matColumnDef="externalId">
                      <th mat-header-cell *matHeaderCellDef>area_id</th>
                      <td mat-cell *matCellDef="let a"><code>{{ a.externalId }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colName') }}</th>
                      <td mat-cell *matCellDef="let a">{{ a.name || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="stopCount">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colStopCount') }}</th>
                      <td mat-cell *matCellDef="let a">{{ a.stopCount }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2AreaColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2AreaColumns"></tr>
                  </table>
                }

                @if (fv2.legRules.length > 0) {
                  <h3 class="section-title">{{ t('admin.gtfsData.sectionLegRules') }} ({{ fv2.legRules.length }})</h3>
                  <table mat-table [dataSource]="fv2.legRules" class="data-table">
                    <ng-container matColumnDef="legGroup">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colLegGroup') }}</th>
                      <td mat-cell *matCellDef="let r"><code>{{ r.legGroupId || '—' }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="from">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colFrom') }}</th>
                      <td mat-cell *matCellDef="let r">{{ r.fromAreaName || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="to">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colTo') }}</th>
                      <td mat-cell *matCellDef="let r">{{ r.toAreaName || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="window">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colWindow') }}</th>
                      <td mat-cell *matCellDef="let r">{{ r.fromTimeframeGroupId || r.toTimeframeGroupId || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="product">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colProduct') }}</th>
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
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colPriority') }}</th>
                      <td mat-cell *matCellDef="let r">{{ r.rulePriority ?? '—' }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2LegColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2LegColumns"></tr>
                  </table>
                }

                @if (fv2.legJoinRules.length > 0) {
                  <h3 class="section-title">{{ t('admin.gtfsData.sectionLegJoinRules') }} ({{ fv2.legJoinRules.length }})</h3>
                  <table mat-table [dataSource]="fv2.legJoinRules" class="data-table">
                    <ng-container matColumnDef="fromNetwork">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colFromNetwork') }}</th>
                      <td mat-cell *matCellDef="let r"><code>{{ r.fromNetworkId || '—' }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="toNetwork">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colToNetwork') }}</th>
                      <td mat-cell *matCellDef="let r"><code>{{ r.toNetworkId || '—' }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="fromStop">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colFromStop') }}</th>
                      <td mat-cell *matCellDef="let r">{{ r.fromStopName || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="toStop">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colToStop') }}</th>
                      <td mat-cell *matCellDef="let r">{{ r.toStopName || '—' }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="v2LegJoinColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: v2LegJoinColumns"></tr>
                  </table>
                }

                @if (fv2.transferRules.length > 0) {
                  <h3 class="section-title">{{ t('admin.gtfsData.sectionTransferRules') }} ({{ fv2.transferRules.length }})</h3>
                  <table mat-table [dataSource]="fv2.transferRules" class="data-table">
                    <ng-container matColumnDef="from">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colFrom') }}</th>
                      <td mat-cell *matCellDef="let r"><code>{{ r.fromLegGroupId || '—' }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="to">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colTo') }}</th>
                      <td mat-cell *matCellDef="let r"><code>{{ r.toLegGroupId || '—' }}</code></td>
                    </ng-container>
                    <ng-container matColumnDef="duration">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colDuration') }}</th>
                      <td mat-cell *matCellDef="let r">
                        @if (r.durationLimit) {
                          {{ r.durationLimit / 60 | number:'1.0-0' }} min
                        } @else { — }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="type">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colType') }}</th>
                      <td mat-cell *matCellDef="let r">{{ transferTypeLabel(r.fareTransferType) }}</td>
                    </ng-container>
                    <ng-container matColumnDef="product">
                      <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colProduct') }}</th>
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
            {{ t('admin.gtfsData.tabTad') }}
            <span class="tab-count">{{ bookingRules().length }}</span>
          </ng-template>

          <div class="tab-content">
            @if (bookingRules().length === 0) {
              <app-empty-state
                icon="phone_callback"
                [title]="t('admin.gtfsData.noBookingRules')"
                [description]="t('admin.gtfsData.noBookingRulesDesc')" />
            } @else {
              <table mat-table [dataSource]="bookingRules()" class="data-table">
                <ng-container matColumnDef="externalId">
                  <th mat-header-cell *matHeaderCellDef>booking_rule_id</th>
                  <td mat-cell *matCellDef="let b"><code>{{ b.externalId || '—' }}</code></td>
                </ng-container>

                <ng-container matColumnDef="bookingType">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colBookingType') }}</th>
                  <td mat-cell *matCellDef="let b">{{ bookingTypeLabel(b.bookingType) }}</td>
                </ng-container>

                <ng-container matColumnDef="notice">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colNotice') }}</th>
                  <td mat-cell *matCellDef="let b">{{ noticeLabel(b) }}</td>
                </ng-container>

                <ng-container matColumnDef="phone">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colPhone') }}</th>
                  <td mat-cell *matCellDef="let b">
                    @if (b.phone) {
                      <a [href]="'tel:' + b.phone">{{ b.phone }}</a>
                    } @else { — }
                  </td>
                </ng-container>

                <ng-container matColumnDef="bookingUrl">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colBookingUrl') }}</th>
                  <td mat-cell *matCellDef="let b">
                    @if (b.bookingUrl) {
                      <a [href]="b.bookingUrl" target="_blank" rel="noopener">
                        {{ t('admin.gtfsData.bookingLink') }} <mat-icon class="inline-icon">open_in_new</mat-icon>
                      </a>
                    } @else { — }
                  </td>
                </ng-container>

                <ng-container matColumnDef="message">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colMessage') }}</th>
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
            {{ t('admin.gtfsData.tabTranslations') }}
            <span class="tab-count">{{ translations().length }}</span>
          </ng-template>

          <div class="tab-content">
            <div class="translation-toolbar">
              <mat-form-field appearance="outline" class="lang-field">
                <mat-label>{{ t('admin.gtfsData.language') }}</mat-label>
                <mat-select [(ngModel)]="language" (selectionChange)="loadTranslations()">
                  @for (l of LANGUAGES; track l) {
                    <mat-option [value]="l">{{ l }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="table-field">
                <mat-label>{{ t('admin.gtfsData.tableFilter') }}</mat-label>
                <mat-select [(ngModel)]="tableFilter" (selectionChange)="loadTranslations()">
                  <mat-option [value]="''">{{ t('admin.gtfsData.allTables') }}</mat-option>
                  @for (tbl of TABLES; track tbl) {
                    <mat-option [value]="tbl">{{ tbl }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <button mat-stroked-button (click)="loadTranslations()" [disabled]="loadingTranslations()">
                <mat-icon>refresh</mat-icon>
                {{ t('admin.gtfsData.reload') }}
              </button>
            </div>

            @if (translations().length === 0) {
              <app-empty-state
                icon="translate"
                [title]="t('admin.gtfsData.noTranslations')"
                [description]="t('admin.gtfsData.noTranslationsDesc')" />
            } @else {
              <table mat-table [dataSource]="translations()" class="data-table">
                <ng-container matColumnDef="tableName">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colTable') }}</th>
                  <td mat-cell *matCellDef="let row"><code>{{ row.tableName }}</code></td>
                </ng-container>

                <ng-container matColumnDef="recordId">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colRecordId') }}</th>
                  <td mat-cell *matCellDef="let row">{{ row.recordId || '—' }}</td>
                </ng-container>

                <ng-container matColumnDef="fieldName">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colField') }}</th>
                  <td mat-cell *matCellDef="let row"><code>{{ row.fieldName }}</code></td>
                </ng-container>

                <ng-container matColumnDef="fieldValue">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colSource') }}</th>
                  <td mat-cell *matCellDef="let row" class="ellipsis">
                    <span [matTooltip]="row.fieldValue || ''">{{ row.fieldValue || '—' }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="translation">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.gtfsData.colTranslation') }}</th>
                  <td mat-cell *matCellDef="let row" class="ellipsis">
                    <span [matTooltip]="row.translation">{{ row.translation }}</span>
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
    </ng-container>
  `,
  styles: `
    .gtfs-data-page { max-width: 1300px; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 4px 0; font-size: var(--m3-type-headline-medium); font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }

    .tab-icon { margin-right: 6px; vertical-align: middle; }
    .tab-count {
      margin-left: 8px;
      font-size: var(--m3-type-label-medium);
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
      font-family: monospace;
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
      font-size: var(--m3-type-body-medium);
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .section-title:first-of-type { margin-top: 0; }
    .muted { color: var(--mat-sys-on-surface-variant); margin-left: 4px; font-size: 0.85em; }
    .table-field { width: 200px; }

    .inline-icon {
      font-size: var(--m3-type-body-medium);
      width: 14px;
      height: 14px;
      vertical-align: middle;
    }
  `,
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
