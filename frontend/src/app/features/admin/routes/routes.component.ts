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
import { RouteService } from '@core/api/route.service';
import { LineService } from '@core/api/line.service';
import { AuthService } from '@core/auth/auth.service';
import { Route, Line } from '@shared/models';
import { RouteDialogComponent, RouteDialogData } from './route-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { fadeIn } from '@shared/animations';

@Component({
  selector: 'app-routes',
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
    <div class="routes-page">
      <div class="page-header">
        <h1 class="page-title">Routes</h1>
        @if (isAdmin()) {
          <button
            mat-flat-button
            color="primary"
            (click)="openCreateDialog()"
            [disabled]="lines().length === 0"
          >
            <mat-icon>add</mat-icon>
            New Route
          </button>
        }
      </div>

      <mat-card class="filter-card">
        <mat-card-content>
          <mat-form-field appearance="outline">
            <mat-label>Filter by Line</mat-label>
            <mat-select [(ngModel)]="selectedLineId" (selectionChange)="loadRoutes()">
              <mat-option value="">All lines</mat-option>
              @for (line of lines(); track line.id) {
                <mat-option [value]="line.id">
                  {{ line.code }} - {{ line.name }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      @if (loading()) {
        <app-table-skeleton
          [rows]="5"
          [columns]="[{ width: '80px' }, { width: '200px' }, { width: '200px' }, { width: '80px' }]"
        />
      } @else if (lines().length === 0) {
        <mat-card @fadeIn>
          <app-empty-state
            icon="alt_route"
            iconColor="primary"
            title="No lines configured"
            description="Create lines first before adding routes."
          />
        </mat-card>
      } @else if (dataSource.data.length === 0) {
        <mat-card @fadeIn>
          <app-empty-state
            icon="alt_route"
            iconColor="primary"
            title="No routes configured"
            description="Routes define directions on a line (e.g., 'Direction Eastern Terminal')."
            [actionLabel]="isAdmin() ? 'Create Route' : ''"
            [actionIcon]="isAdmin() ? 'add' : ''"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else {
        <mat-card @fadeIn>
          <table mat-table [dataSource]="dataSource" matSort class="full-width">
            <ng-container matColumnDef="line">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Line</th>
              <td mat-cell *matCellDef="let route">
                <span class="line-badge" [style.backgroundColor]="route.line.color">
                  {{ route.line.code }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Route Name</th>
              <td mat-cell *matCellDef="let route">{{ route.name }}</td>
            </ng-container>

            <ng-container matColumnDef="terminusName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Terminus</th>
              <td mat-cell *matCellDef="let route" class="terminus-cell">
                {{ route.terminusName }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">Actions</th>
              <td mat-cell *matCellDef="let route" class="actions-column">
                @if (isAdmin()) {
                  <button mat-icon-button color="primary" (click)="openEditDialog(route)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteRoute(route)">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
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

    .filter-card {
      margin-bottom: 28px;
      border-radius: 12px;
    }

    .filter-card mat-form-field {
      width: 300px;
      max-width: 100%;
    }

    .full-width {
      width: 100%;
    }

    mat-card {
      border-radius: 12px;
      overflow: hidden;
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

    .terminus-cell {
      font-weight: 500;
      color: var(--app-on-surface);
    }

    .actions-column {
      text-align: right;
      width: 120px;
    }

    @media (max-width: 600px) {
      .filter-card mat-form-field {
        width: 100%;
      }
    }
  `,
})
export class RoutesComponent implements OnInit, AfterViewInit {
  private readonly routeService = inject(RouteService);
  private readonly lineService = inject(LineService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly isAdmin = this.authService.isAdmin;

  readonly sort = viewChild(MatSort);
  loading = signal(true);
  lines = signal<Line[]>([]);
  dataSource = new MatTableDataSource<Route>([]);
  selectedLineId = '';

  get displayedColumns(): string[] {
    const columns = ['line', 'name', 'terminusName'];
    if (this.isAdmin()) {
      columns.push('actions');
    }
    return columns;
  }

  ngOnInit(): void {
    this.lineService.getAll().subscribe((lines) => {
      this.lines.set(lines);
      this.loadRoutes();
    });
  }

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      this.dataSource.sort = sortRef;
    }
  }

  loadRoutes(): void {
    this.loading.set(true);
    const lineId = this.selectedLineId || undefined;
    this.routeService.getAll(lineId).subscribe({
      next: (routes) => {
        this.dataSource.data = routes;
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(RouteDialogComponent, {
      data: { lines: this.lines() } as RouteDialogData,
      width: '450px',
      ariaLabel: 'Create new route',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.routeService.create(result).subscribe(() => {
          this.loadRoutes();
          this.snackBar.open('Route created', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }

  openEditDialog(route: Route): void {
    const dialogRef = this.dialog.open(RouteDialogComponent, {
      data: { route, lines: this.lines() } as RouteDialogData,
      width: '450px',
      ariaLabel: `Edit route ${route.name}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.routeService.update(route.id, result).subscribe(() => {
          this.loadRoutes();
          this.snackBar.open('Route updated', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }

  deleteRoute(route: Route): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Route',
        message: `Delete route "${route.name}" (${route.terminusName})? This will also delete all associated schedule entries.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of route ${route.name}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.routeService.delete(route.id).subscribe(() => {
          this.loadRoutes();
          this.snackBar.open('Route deleted', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }
}
