import { Component, OnInit, inject, signal, viewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { Line, Stop } from '@shared/models';
import { StopDialogComponent, StopDialogData } from './stop-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { fadeIn } from '@shared/animations';

@Component({
  selector: 'app-stops',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSortModule,
    TableSkeletonComponent,
    EmptyStateComponent,
  ],
  animations: [fadeIn],
  template: `
    <div class="stops-page">
      <div class="page-header">
        <h1 class="page-title">Stops</h1>
        <button
          mat-flat-button
          color="primary"
          (click)="openCreateDialog()"
          [disabled]="lines().length === 0"
        >
          <mat-icon>add</mat-icon>
          New Stop
        </button>
      </div>

      <mat-form-field appearance="outline" class="line-filter">
        <mat-label>Filter by Line</mat-label>
        <mat-select [(ngModel)]="selectedLineId" (selectionChange)="loadStops()">
          <mat-option value="">All Lines</mat-option>
          @for (line of lines(); track line.id) {
            <mat-option [value]="line.id">
              {{ line.code }} - {{ line.name }}
            </mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (loading()) {
        <app-table-skeleton
          [rows]="5"
          [columns]="[
            { width: '60px', height: '32px' },
            { width: '180px' },
            { width: '100px' },
            { width: '80px' }
          ]"
        />
      } @else if (dataSource.data.length === 0) {
        <mat-card @fadeIn>
          @if (lines().length === 0) {
            <app-empty-state
              icon="subway"
              title="Create a line first"
              description="You need to create at least one line before adding stops."
            />
          } @else {
            <app-empty-state
              icon="place"
              iconColor="primary"
              title="No stops found"
              description="Create stops to define passenger boarding points on your lines."
              actionLabel="Create Stop"
              actionIcon="add"
              (action)="openCreateDialog()"
            />
          }
        </mat-card>
      } @else {
        <mat-card @fadeIn>
          <table mat-table [dataSource]="dataSource" matSort class="full-width">
            <ng-container matColumnDef="line">
              <th mat-header-cell *matHeaderCellDef>Lines</th>
              <td mat-cell *matCellDef="let stop">
                <div class="line-badges">
                  @for (line of stop.lines; track line.id) {
                    <span class="line-badge" [style.backgroundColor]="line.color">
                      {{ line.code }}
                    </span>
                  }
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
              <td mat-cell *matCellDef="let stop">{{ stop.name }}</td>
            </ng-container>

            <ng-container matColumnDef="schedules">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="scheduleCount" class="hide-mobile">
                Schedules
              </th>
              <td mat-cell *matCellDef="let stop" class="hide-mobile">{{ stop.scheduleCount }} entries</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">Actions</th>
              <td mat-cell *matCellDef="let stop" class="actions-column">
                <button mat-icon-button color="primary" (click)="openEditDialog(stop)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteStop(stop)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </mat-card>
      }
    </div>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }

    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--app-on-surface);
      margin: 0;
      letter-spacing: -0.5px;
    }

    .line-filter {
      margin-bottom: 20px;
      width: 300px;
    }

    .full-width {
      width: 100%;
    }

    mat-card {
      border-radius: 12px;
      overflow: hidden;
    }

    .line-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .line-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 16px;
      color: white;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .actions-column {
      text-align: right;
      width: 120px;
    }

    .hide-mobile {
      @media (max-width: 600px) {
        display: none !important;
      }
    }

    @media (max-width: 600px) {
      .line-filter {
        width: 100%;
      }
    }
  `,
})
export class StopsComponent implements OnInit, AfterViewInit {
  private readonly lineService = inject(LineService);
  private readonly stopService = inject(StopService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly sort = viewChild(MatSort);
  loading = signal(true);
  lines = signal<Line[]>([]);
  dataSource = new MatTableDataSource<Stop>([]);
  selectedLineId = '';
  displayedColumns = ['line', 'name', 'schedules', 'actions'];

  ngOnInit(): void {
    this.loadLines();
    this.loadStops();
  }

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      this.dataSource.sort = sortRef;
      this.dataSource.sortingDataAccessor = (item, property) => {
        switch (property) {
          case 'name':
            return item.name;
          case 'scheduleCount':
            return item.scheduleCount;
          default:
            return '';
        }
      };
    }
  }

  loadLines(): void {
    this.lineService.getAll().subscribe((lines) => this.lines.set(lines));
  }

  loadStops(): void {
    this.loading.set(true);
    const lineId = this.selectedLineId || undefined;
    this.stopService.getAll(lineId).subscribe({
      next: (stops) => {
        this.dataSource.data = stops;
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(StopDialogComponent, {
      data: {
        lines: this.lines(),
        selectedLineId: this.selectedLineId,
      } as StopDialogData,
      width: '450px',
      ariaLabel: 'Create new stop',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.stopService.create(result).subscribe(() => {
          this.loadStops();
          this.snackBar.open('Stop created', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }

  openEditDialog(stop: Stop): void {
    const dialogRef = this.dialog.open(StopDialogComponent, {
      data: {
        stop,
        lines: this.lines(),
      } as StopDialogData,
      width: '450px',
      ariaLabel: `Edit stop ${stop.name}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.stopService.update(stop.id, result).subscribe(() => {
          this.loadStops();
          this.snackBar.open('Stop updated', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }

  deleteStop(stop: Stop): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Stop',
        message: `Delete stop "${stop.name}"? This will also delete all associated schedules.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of stop ${stop.name}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.stopService.delete(stop.id).subscribe(() => {
          this.loadStops();
          this.snackBar.open('Stop deleted', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }
}
