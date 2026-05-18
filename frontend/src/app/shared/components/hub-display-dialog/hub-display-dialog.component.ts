import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoDirective } from '@jsverse/transloco';
import { StopService } from '@core/api/stop.service';
import { Line, Stop } from '@shared/models';

export interface HubDisplayDialogData {
  lines: Line[];
  preselectedStopIds?: string[];
}

export interface HubDisplayDialogResult {
  stopIds: string[];
  hubName: string;
}

@Component({
  selector: 'app-hub-display-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <h2 mat-dialog-title>{{ t('admin.hubDisplay.title') }}</h2>

      <mat-dialog-content>
        <div class="filters">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>{{ t('admin.hubDisplay.filterByLine') }}</mat-label>
            <mat-select [value]="lineFilter()" (selectionChange)="lineFilter.set($event.value)">
              <mat-option value="">{{ t('admin.hubDisplay.allLines') }}</mat-option>
              @for (line of data.lines; track line.id) {
                <mat-option [value]="line.id">
                  {{ line.code }} - {{ line.name }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>{{ t('admin.hubDisplay.searchStops') }}</mat-label>
            <input
              matInput
              [value]="searchFilter()"
              (input)="searchFilter.set($any($event.target).value)"
            />
            @if (searchFilter()) {
              <button matSuffix mat-icon-button (click)="searchFilter.set('')">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>
        </div>

        <div class="stop-list">
          @if (loading()) {
            <div class="loading-state">{{ t('admin.hubDisplay.loadingStops') }}</div>
          } @else if (filteredStops().length === 0) {
            <div class="empty-state">{{ t('admin.hubDisplay.noStopsMatch') }}</div>
          } @else {
            @for (stop of filteredStops(); track stop.id) {
              <button
                type="button"
                class="stop-item"
                [class.selected]="selectedIds().has(stop.id)"
                [attr.aria-pressed]="selectedIds().has(stop.id)"
                (click)="toggleStop(stop.id)"
              >
                <mat-checkbox
                  [checked]="selectedIds().has(stop.id)"
                  (click)="$event.stopPropagation()"
                  (change)="toggleStop(stop.id)"
                />
                <span class="stop-name">{{ stop.name }}</span>
                <div class="stop-lines">
                  @for (line of stop.lines; track line.id) {
                    <span class="line-badge" [style.backgroundColor]="line.color">
                      {{ line.code }}
                    </span>
                  }
                </div>
              </button>
            }
          }
        </div>

        @if (selectedStops().length > 0) {
          <div class="selection-summary">
            <div class="selected-label">
              {{ t('admin.hubDisplay.selected', { count: selectedStops().length, names: selectedStopNames() }) }}
            </div>

            <mat-form-field appearance="outline" class="hub-name-field">
              <mat-label>{{ t('admin.hubDisplay.hubName') }}</mat-label>
              <input
                matInput
                [ngModel]="hubName()"
                (ngModelChange)="hubName.set($event)"
              />
            </mat-form-field>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ t('common.cancel') }}</button>
        <button
          mat-flat-button
          color="primary"
          [disabled]="selectedStops().length < 2"
          (click)="confirm()"
        >
          <mat-icon>hub</mat-icon>
          {{ t('admin.hubDisplay.openHub') }}
        </button>
      </mat-dialog-actions>
    </ng-container>
  `,
  styles: `
    mat-dialog-content {
      min-width: 450px;
      max-height: 60vh;
    }

    .filters {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
    }

    .filter-field {
      flex: 1;
    }

    .stop-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 300px;
      overflow-y: auto;
      padding: 4px 0;
    }

    .stop-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--app-radius-sm);
      background-color: var(--app-surface-variant);
      cursor: pointer;
      transition: background-color var(--m3-duration-short3) var(--m3-easing-standard);
      /* Reset native button look so the row reads like a list item;
         <button> chosen over <div> for keyboard accessibility
         (Enter + Space activate it natively). */
      width: 100%;
      border: none;
      font: inherit;
      color: inherit;
      text-align: left;
    }

    .stop-item:hover {
      background-color: var(--app-surface-container-high);
    }

    .stop-item:focus-visible {
      outline: 2px solid var(--app-primary, #1976d2);
      outline-offset: 1px;
    }

    .stop-item.selected {
      background-color: var(--app-primary-container, var(--app-surface-container-high));
    }

    .stop-name {
      flex: 1;
      font-weight: 500;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stop-lines {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .line-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--app-line-badge-radius);
      color: white;
      font-size: var(--m3-type-label-small);
      font-weight: 600;
    }

    .loading-state,
    .empty-state {
      padding: 32px;
      text-align: center;
      color: var(--app-on-surface-variant);
    }

    .selection-summary {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--app-outline-variant);
    }

    .selected-label {
      font-size: var(--m3-type-body-small);
      color: var(--app-on-surface-variant);
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .hub-name-field {
      width: 100%;
    }

    @media (max-width: 600px) {
      mat-dialog-content {
        min-width: unset;
      }

      .filters {
        flex-direction: column;
        gap: 0;
      }
    }
  `,
})
export class HubDisplayDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<HubDisplayDialogComponent>);
  private readonly stopService = inject(StopService);
  readonly data = inject<HubDisplayDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly allStops = signal<Stop[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly lineFilter = signal<string>('');
  readonly searchFilter = signal<string>('');
  readonly hubName = signal<string>('');
  private hubNameManuallyEdited = false;

  readonly filteredStops = computed(() => {
    let stops = this.allStops();
    const lineId = this.lineFilter();
    const search = this.searchFilter().toLowerCase();

    if (lineId) {
      stops = stops.filter((s) => s.lines.some((l) => l.id === lineId));
    }
    if (search) {
      stops = stops.filter((s) => s.name.toLowerCase().includes(search));
    }
    return stops;
  });

  readonly selectedStops = computed(() => {
    const ids = this.selectedIds();
    return this.allStops().filter((s) => ids.has(s.id));
  });

  readonly selectedStopNames = computed(() =>
    this.selectedStops()
      .map((s) => s.name)
      .join(', ')
  );

  private readonly autoHubName = computed(() =>
    this.selectedStops()
      .map((s) => s.name)
      .join(' / ')
  );

  constructor() {
    effect(() => {
      const autoName = this.autoHubName();
      if (!this.hubNameManuallyEdited) {
        this.hubName.set(autoName);
      }
    });

    if (this.data.preselectedStopIds?.length) {
      this.selectedIds.set(new Set(this.data.preselectedStopIds));
    }

    this.stopService.getAll().subscribe({
      next: (stops) => {
        this.allStops.set(stops);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  toggleStop(stopId: string): void {
    const current = this.selectedIds();
    const next = new Set(current);
    if (next.has(stopId)) {
      next.delete(stopId);
    } else {
      next.add(stopId);
    }
    this.selectedIds.set(next);
    this.hubNameManuallyEdited = false;
  }

  confirm(): void {
    this.dialogRef.close({
      stopIds: [...this.selectedIds()],
      hubName: this.hubName(),
    });
  }
}
