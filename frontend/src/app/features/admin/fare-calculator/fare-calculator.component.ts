import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';

import { FareCalculatorService } from '@core/api/fare-calculator.service';
import { StopService } from '@core/api/stop.service';
import { FareCalculationResult, Stop } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TranslocoDirective } from '@jsverse/transloco';

/**
 * Admin tool to test the public fare calculator without leaving the
 * back-office. Pick an origin stop, a destination stop, hit "Calculate"
 * — the page renders both V1 (fare_attributes + fare_rules) and V2
 * (fare_leg_rules + areas) options side by side.
 */
@Component({
  selector: 'app-fare-calculator',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    EmptyStateComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <div class="fare-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.fareCalculator.title') }}</h1>
        <p class="page-subtitle">{{ t('admin.fareCalculator.subtitle') }}</p>
      </div>

      <mat-card class="picker-card">
        <mat-card-content>
          <div class="picker-row">
            <mat-form-field appearance="outline" class="stop-picker">
              <mat-label>{{ t('admin.fareCalculator.fieldOrigin') }}</mat-label>
              <input
                matInput
                [(ngModel)]="originText"
                (input)="onSearch('origin')"
                [matAutocomplete]="originAuto"
                [placeholder]="t('admin.fareCalculator.fieldOriginPlaceholder')" />
              <mat-autocomplete #originAuto="matAutocomplete"
                                (optionSelected)="onStopSelected('origin', $event.option.value)"
                                [displayWith]="displayStop">
                @for (s of originResults(); track s.id) {
                  <mat-option [value]="s">{{ s.name }}</mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>

            <mat-form-field appearance="outline" class="stop-picker">
              <mat-label>{{ t('admin.fareCalculator.fieldDest') }}</mat-label>
              <input
                matInput
                [(ngModel)]="destText"
                (input)="onSearch('dest')"
                [matAutocomplete]="destAuto"
                [placeholder]="t('admin.fareCalculator.fieldDestPlaceholder')" />
              <mat-autocomplete #destAuto="matAutocomplete"
                                (optionSelected)="onStopSelected('dest', $event.option.value)"
                                [displayWith]="displayStop">
                @for (s of destResults(); track s.id) {
                  <mat-option [value]="s">{{ s.name }}</mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>

            <button mat-flat-button
                    color="primary"
                    [disabled]="!origin() || !dest()"
                    (click)="calculate()">
              <mat-icon>calculate</mat-icon>
              {{ t('admin.fareCalculator.calculate') }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      @if (result(); as r) {
        <div class="results-grid">
          <mat-card>
            <mat-card-header>
              <mat-card-title>Fares V1 ({{ r.v1.length }})</mat-card-title>
              <mat-card-subtitle>{{ t('admin.fareCalculator.v1Subtitle') }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (r.v1.length === 0) {
                <p class="muted">{{ t('admin.fareCalculator.noV1') }}</p>
              } @else {
                <table mat-table [dataSource]="r.v1" class="full-width">
                  <ng-container matColumnDef="fareId">
                    <th mat-header-cell *matHeaderCellDef>{{ t('admin.fareCalculator.colFare') }}</th>
                    <td mat-cell *matCellDef="let f">{{ f.fareId }}</td>
                  </ng-container>
                  <ng-container matColumnDef="price">
                    <th mat-header-cell *matHeaderCellDef>{{ t('admin.fareCalculator.colPrice') }}</th>
                    <td mat-cell *matCellDef="let f">
                      {{ f.price | number:'1.2-2' }} {{ f.currency }}
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="transfers">
                    <th mat-header-cell *matHeaderCellDef>{{ t('admin.fareCalculator.colTransfers') }}</th>
                    <td mat-cell *matCellDef="let f">{{ formatTransfers(f.transfers) }}</td>
                  </ng-container>
                  <ng-container matColumnDef="match">
                    <th mat-header-cell *matHeaderCellDef>{{ t('admin.fareCalculator.colMatch') }}</th>
                    <td mat-cell *matCellDef="let f">
                      @if (f.matchedRoute) { {{ t('admin.fareCalculator.matchedRoute', { route: f.matchedRoute }) }} }
                      {{ f.matchedOriginZone || '*' }} → {{ f.matchedDestinationZone || '*' }}
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="v1Cols"></tr>
                  <tr mat-row *matRowDef="let row; columns: v1Cols"></tr>
                </table>
              }
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-header>
              <mat-card-title>Fares V2 ({{ r.v2.length }})</mat-card-title>
              <mat-card-subtitle>{{ t('admin.fareCalculator.v2Subtitle') }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (r.v2.length === 0) {
                <p class="muted">{{ t('admin.fareCalculator.noV2') }}</p>
              } @else {
                <table mat-table [dataSource]="r.v2" class="full-width">
                  <ng-container matColumnDef="product">
                    <th mat-header-cell *matHeaderCellDef>{{ t('admin.fareCalculator.colProduct') }}</th>
                    <td mat-cell *matCellDef="let row">
                      {{ row.fareProductName || row.fareProductId || '—' }}
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="amount">
                    <th mat-header-cell *matHeaderCellDef>{{ t('admin.fareCalculator.colAmount') }}</th>
                    <td mat-cell *matCellDef="let row">
                      @if (row.amount !== null) {
                        {{ row.amount | number:'1.2-2' }} {{ row.currency }}
                      }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="from">
                    <th mat-header-cell *matHeaderCellDef>{{ t('admin.fareCalculator.colFromArea') }}</th>
                    <td mat-cell *matCellDef="let row">{{ row.fromAreaName || row.fromAreaId || '*' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="to">
                    <th mat-header-cell *matHeaderCellDef>{{ t('admin.fareCalculator.colToArea') }}</th>
                    <td mat-cell *matCellDef="let row">{{ row.toAreaName || row.toAreaId || '*' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="priority">
                    <th mat-header-cell *matHeaderCellDef>{{ t('admin.fareCalculator.colPriority') }}</th>
                    <td mat-cell *matCellDef="let row">{{ row.rulePriority ?? '—' }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="v2Cols"></tr>
                  <tr mat-row *matRowDef="let row; columns: v2Cols"></tr>
                </table>
              }
            </mat-card-content>
          </mat-card>
        </div>
      } @else if (errored()) {
        <mat-card>
          <app-empty-state icon="error_outline"
                           [title]="t('admin.fareCalculator.errorTitle')"
                           [description]="t('admin.fareCalculator.errorDesc')" />
        </mat-card>
      }
    </div>
    </ng-container>
  `,
  styles: `
    .fare-page { max-width: 1200px; }
    .page-header { margin-bottom: 16px; }
    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--app-on-surface);
      margin: 0 0 6px;
    }
    .page-subtitle { color: var(--app-on-surface-muted); margin: 0; }
    .picker-card { margin-bottom: 16px; }
    .picker-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 12px;
      align-items: start;
    }
    .stop-picker { width: 100%; }
    .results-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 800px) {
      .picker-row, .results-grid {
        grid-template-columns: 1fr;
      }
    }
    .muted { color: var(--mat-sys-on-surface-variant); font-style: italic; }
    .full-width { width: 100%; }
  `,
})
export class FareCalculatorComponent implements OnInit {
  private readonly fareService = inject(FareCalculatorService);
  private readonly stopService = inject(StopService);

  readonly origin = signal<Stop | null>(null);
  readonly dest = signal<Stop | null>(null);
  readonly originResults = signal<Stop[]>([]);
  readonly destResults = signal<Stop[]>([]);
  readonly result = signal<FareCalculationResult | null>(null);
  readonly errored = signal<boolean>(false);

  originText = '';
  destText = '';

  private allStops: Stop[] = [];

  readonly v1Cols = ['fareId', 'price', 'transfers', 'match'];
  readonly v2Cols = ['product', 'amount', 'from', 'to', 'priority'];

  ngOnInit(): void {
    this.stopService.getAll().subscribe({
      next: (data) => {
        this.allStops = data;
        this.originResults.set(data.slice(0, 30));
        this.destResults.set(data.slice(0, 30));
      },
      error: () => { this.allStops = []; },
    });
  }

  onSearch(field: 'origin' | 'dest'): void {
    const text = (field === 'origin' ? this.originText : this.destText).toLowerCase().trim();
    const filtered = !text
      ? this.allStops.slice(0, 30)
      : this.allStops.filter(s => s.name.toLowerCase().includes(text)).slice(0, 30);
    if (field === 'origin') {this.originResults.set(filtered);} else {this.destResults.set(filtered);}
  }

  onStopSelected(field: 'origin' | 'dest', stop: Stop): void {
    if (field === 'origin') {
      this.origin.set(stop);
      this.originText = stop.name;
    } else {
      this.dest.set(stop);
      this.destText = stop.name;
    }
  }

  displayStop(stop: Stop | string | null): string {
    if (!stop) {return '';}
    if (typeof stop === 'string') {return stop;}
    return stop.name;
  }

  calculate(): void {
    const o = this.origin();
    const d = this.dest();
    if (!o || !d) {return;}
    this.errored.set(false);
    this.fareService.calculate(o.id, d.id).subscribe(r => {
      if (r) {
        this.result.set(r);
      } else {
        this.errored.set(true);
        this.result.set(null);
      }
    });
  }

  formatTransfers(t: number | null): string {
    if (t === null) {return '∞';}
    return String(t);
  }
}
