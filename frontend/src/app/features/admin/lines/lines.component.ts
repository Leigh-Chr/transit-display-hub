import { Component, OnInit, inject, signal, viewChild, AfterViewInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { LineService } from '@core/api/line.service';
import { Line } from '@shared/models';
import { LineDialogComponent } from './line-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { fadeIn } from '@shared/animations';

@Component({
  selector: 'app-lines',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSortModule,
    TableSkeletonComponent,
    EmptyStateComponent,
  ],
  animations: [fadeIn],
  template: `
    <div class="lines-page">
      <div class="page-header">
        <h1 class="page-title">Lines</h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          New Line
        </button>
      </div>

      @if (loading()) {
        <app-table-skeleton
          [rows]="4"
          [columns]="[
            { width: '60px', height: '32px' },
            { width: '150px' },
            { width: '120px' },
            { width: '80px' },
            { width: '80px' }
          ]"
        />
      } @else if (dataSource.data.length === 0) {
        <mat-card @fadeIn>
          <app-empty-state
            icon="subway"
            iconColor="primary"
            title="No lines configured"
            description="Create your first line to start building your transit network."
            actionLabel="Create Line"
            actionIcon="add"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else {
        <mat-card @fadeIn>
          <table mat-table [dataSource]="dataSource" matSort class="full-width">
            <ng-container matColumnDef="code">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Code</th>
              <td mat-cell *matCellDef="let line">
                <span class="line-badge" [style.backgroundColor]="line.color">
                  {{ line.code }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
              <td mat-cell *matCellDef="let line">{{ line.name }}</td>
            </ng-container>

            <ng-container matColumnDef="color">
              <th mat-header-cell *matHeaderCellDef class="hide-mobile">Color</th>
              <td mat-cell *matCellDef="let line" class="hide-mobile">
                <div class="color-display">
                  <div class="color-swatch" [style.backgroundColor]="line.color"></div>
                  <span class="color-code">{{ line.color }}</span>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="stops">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="stopCount">Stops</th>
              <td mat-cell *matCellDef="let line">{{ line.stopCount }} stops</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">Actions</th>
              <td mat-cell *matCellDef="let line" class="actions-column">
                <button mat-icon-button color="primary" (click)="openEditDialog(line)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteLine(line)">
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

    .full-width {
      width: 100%;
    }

    .line-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .color-display {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .color-swatch {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid var(--app-outline);
    }

    .color-code {
      color: var(--app-on-surface-variant);
      font-size: 13px;
      font-family: 'SF Mono', 'Consolas', monospace;
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
  `,
})
export class LinesComponent implements OnInit, AfterViewInit {
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly sort = viewChild(MatSort);
  loading = signal(true);
  dataSource = new MatTableDataSource<Line>([]);
  displayedColumns = ['code', 'name', 'color', 'stops', 'actions'];

  ngOnInit(): void {
    this.loadLines();
  }

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      this.dataSource.sort = sortRef;
    }
  }

  loadLines(): void {
    this.loading.set(true);
    this.lineService.getAll().subscribe({
      next: (lines) => {
        this.dataSource.data = lines;
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(LineDialogComponent, {
      data: {},
      width: '450px',
      ariaLabel: 'Create new line',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.lineService.create(result).subscribe(() => {
          this.loadLines();
          this.snackBar.open('Line created', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }

  openEditDialog(line: Line): void {
    const dialogRef = this.dialog.open(LineDialogComponent, {
      data: { line },
      width: '450px',
      ariaLabel: `Edit line ${line.name}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.lineService.update(line.id, result).subscribe(() => {
          this.loadLines();
          this.snackBar.open('Line updated', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }

  deleteLine(line: Line): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Line',
        message: `Delete line "${line.name}"? This will also delete all associated stops and schedules.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of line ${line.name}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.lineService.delete(line.id).subscribe(() => {
          this.loadLines();
          this.snackBar.open('Line deleted', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }
}
