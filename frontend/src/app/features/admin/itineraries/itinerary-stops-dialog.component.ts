import { ChangeDetectionStrategy, Component, inject, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragHandle, CdkDragDrop, CdkDragPlaceholder, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { NotifyService } from '@core/services/notify.service';
import { StopService } from '@core/api/stop.service';
import { Itinerary, Stop, UpdateItineraryStopsRequest } from '@shared/models';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

export interface ItineraryStopsDialogData {
  itinerary: Itinerary;
}

interface StopItem {
  id: string;
  name: string;
}

@Component({
  selector: 'app-itinerary-stops-dialog',
  standalone: true,
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslocoDirective,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <h2 mat-dialog-title>{{ t('admin.itineraries.stopsDialog.title', { name: data.itinerary.name }) }}</h2>

    <mat-dialog-content class="itinerary-stops-dialog-content">
      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="40" [attr.aria-label]="t('admin.itineraries.stopsDialog.title', { name: data.itinerary.name })" />
        </div>
      } @else {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.itineraries.stopsDialog.addStop') }}</mat-label>
          <mat-select
            [value]="null"
            (selectionChange)="addStop($event.value); $event.source.value = null"
            [disabled]="availableStops().length === 0"
          >
            @for (stop of availableStops(); track stop.id) {
              <mat-option [value]="stop.id">{{ stop.name }}</mat-option>
            }
            @if (availableStops().length === 0) {
              <mat-option disabled>{{ t('admin.itineraries.stopsDialog.noMoreStops') }}</mat-option>
            }
          </mat-select>
          <mat-hint>{{ t('admin.itineraries.stopsDialog.addStopHint') }}</mat-hint>
        </mat-form-field>

        @if (selectedStops().length > 0) {
          <div cdkDropList class="stop-list" (cdkDropListDropped)="onDrop($event)">
            @for (stop of selectedStops(); track stop.id; let i = $index) {
              <div cdkDrag class="stop-item">
                <mat-icon cdkDragHandle class="drag-handle">drag_handle</mat-icon>
                <span class="position">{{ i + 1 }}</span>
                <span class="name">{{ stop.name }}</span>
                <button
                  mat-icon-button
                  color="warn"
                  (click)="removeStop(i)"
                  class="delete-btn"
                  [attr.aria-label]="t('admin.itineraries.stopsDialog.removeTooltip')"
                >
                  <mat-icon>delete</mat-icon>
                </button>
                <div class="drop-placeholder" *cdkDragPlaceholder></div>
              </div>
            }
          </div>

          <p class="terminus-info">
            <mat-icon class="terminus-icon">flag</mat-icon>
            <span>{{ t('admin.itineraries.stopsDialog.terminusLabel') }} <strong>{{ selectedStops()[selectedStops().length - 1]?.name }}</strong></span>
          </p>
        } @else {
          <p class="empty-message">
            <mat-icon>info</mat-icon>
            {{ t('admin.itineraries.stopsDialog.noStopsYet') }}
          </p>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ t('common.cancel') }}</button>
      <button
        mat-flat-button
        color="primary"
        (click)="save()"
        [disabled]="loading() || selectedStops().length === 0"
      >{{ t('admin.itineraries.stopsDialog.actionSave') }}</button>
    </mat-dialog-actions>
    </ng-container>
  `,
  styles: `
    .itinerary-stops-dialog-content {
      min-width: 400px;
      max-height: 60vh;
    }

    .itinerary-stops-dialog-content .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 48px;
    }

    .itinerary-stops-dialog-content .full-width {
      width: 100%;
    }

    .itinerary-stops-dialog-content .stop-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 16px 0;
    }

    .itinerary-stops-dialog-content .stop-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: var(--app-surface-variant);
      border-radius: var(--app-radius-sm);
      cursor: move;
      transition: box-shadow 0.2s, background-color 0.2s;
    }

    .itinerary-stops-dialog-content .stop-item:hover {
      background: var(--app-surface-hover, rgba(0, 0, 0, 0.04));
    }

    .itinerary-stops-dialog-content .drag-handle {
      cursor: grab;
      color: var(--app-on-surface-muted);
    }

    .itinerary-stops-dialog-content .drag-handle:active {
      cursor: grabbing;
    }

    .itinerary-stops-dialog-content .position {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: var(--app-primary);
      color: white;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .itinerary-stops-dialog-content .name {
      flex: 1;
      font-weight: 500;
    }

    .itinerary-stops-dialog-content .delete-btn {
      opacity: 0.6;
      transition: opacity 0.2s;
    }

    .itinerary-stops-dialog-content .stop-item:hover .delete-btn {
      opacity: 1;
    }

    .itinerary-stops-dialog-content .drop-placeholder {
      background: var(--app-primary);
      opacity: 0.2;
      border-radius: var(--app-radius-sm);
      min-height: 44px;
    }

    /* CDK drag-drop global styles */
    .cdk-drag-preview.stop-item {
      box-sizing: border-box;
      border-radius: var(--app-radius-sm);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      background: var(--app-surface, #fff);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .itinerary-stops-dialog-content .stop-list.cdk-drop-list-dragging .stop-item:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .itinerary-stops-dialog-content .terminus-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--app-surface-variant);
      border-radius: var(--app-radius-sm);
      margin: 0;
      font-size: 14px;
    }

    .itinerary-stops-dialog-content .terminus-icon {
      color: var(--app-primary);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .itinerary-stops-dialog-content .empty-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 24px;
      background: var(--app-surface-variant);
      border-radius: var(--app-radius-sm);
      color: var(--app-on-surface-muted);
      font-size: 14px;
      margin: 16px 0 0;
    }

    .itinerary-stops-dialog-content .empty-message mat-icon {
      color: var(--app-on-surface-muted);
    }
  `,
})
export class ItineraryStopsDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ItineraryStopsDialogComponent>);
  readonly data = inject<ItineraryStopsDialogData>(MAT_DIALOG_DATA);
  private readonly stopService = inject(StopService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  readonly loading = signal(true);
  readonly availableStops = signal<Stop[]>([]);
  readonly selectedStops = signal<StopItem[]>([]);

  private allLineStops: Stop[] = [];

  ngOnInit(): void {
    // Initialize selectedStops from itinerary's current stops
    const currentStops: StopItem[] = this.data.itinerary.stops
      .sort((a, b) => a.position - b.position)
      .map(s => ({ id: s.id, name: s.name }));
    this.selectedStops.set(currentStops);

    // Load all stops for the line
    const lineId = this.data.itinerary.line.id;
    if (lineId) {
      this.stopService.getAll(lineId).subscribe({
        next: (stops) => {
          this.allLineStops = stops;
          this.updateAvailableStops();
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notify.error('Failed to load stops');
        },
      });
    } else {
      this.loading.set(false);
    }
  }

  private updateAvailableStops(): void {
    const selectedIds = new Set(this.selectedStops().map(s => s.id));
    const available = this.allLineStops.filter(s => !selectedIds.has(s.id));
    this.availableStops.set(available);
  }

  onDrop(event: CdkDragDrop<StopItem[]>): void {
    const stops = [...this.selectedStops()];
    moveItemInArray(stops, event.previousIndex, event.currentIndex);
    this.selectedStops.set(stops);
  }

  addStop(stopId: string): void {
    if (!stopId) {return;}

    const stop = this.allLineStops.find(s => s.id === stopId);
    if (stop) {
      this.selectedStops.update(stops => [...stops, { id: stop.id, name: stop.name }]);
      this.updateAvailableStops();
    }
  }

  removeStop(index: number): void {
    this.selectedStops.update(stops => stops.filter((_, i) => i !== index));
    this.updateAvailableStops();
  }

  save(): void {
    const request: UpdateItineraryStopsRequest = {
      stopIds: this.selectedStops().map(s => s.id),
    };
    this.dialogRef.close(request);
  }
}
