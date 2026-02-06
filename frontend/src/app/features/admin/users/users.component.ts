import { Component, OnInit, inject, signal, viewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Subject, takeUntil } from 'rxjs';
import { UserService } from '@core/api/user.service';
import { AuthService } from '@core/auth/auth.service';
import { User, PageResponse } from '@shared/models';
import { UserDialogComponent, UserDialogData } from './user-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { fadeIn } from '@shared/animations';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSortModule,
    MatPaginatorModule,
    TableSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
  ],
  animations: [fadeIn],
  template: `
    <div class="users-page">
      <div class="page-header">
        <h1 class="page-title">Users</h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>person_add</mat-icon>
          New User
        </button>
      </div>

      <div class="toolbar">
        <app-search-input
          placeholder="Search users..."
          [initialValue]="search"
          (searchChange)="onSearchChange($event)"
        />
      </div>

      @if (loading()) {
        <app-table-skeleton
          [rows]="4"
          [columns]="[{ width: '150px' }, { width: '100px' }, { width: '80px' }, { width: '80px' }]"
        />
      } @else if (dataSource.data.length === 0 && !search) {
        <mat-card @fadeIn>
          <app-empty-state
            icon="people"
            iconColor="primary"
            title="No users configured"
            description="Create users to manage access to the admin panel."
            actionLabel="Create User"
            actionIcon="person_add"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else if (dataSource.data.length === 0 && search) {
        <mat-card @fadeIn>
          <app-empty-state
            icon="search_off"
            title="No results found"
            description="Try adjusting your search terms."
          />
        </mat-card>
      } @else {
        <mat-card @fadeIn>
          <table mat-table [dataSource]="dataSource" matSort (matSortChange)="onSortChange($event)" class="full-width">
            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Username</th>
              <td mat-cell *matCellDef="let user">
                <div class="username-cell">
                  <mat-icon class="user-icon">person</mat-icon>
                  {{ user.username }}
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Role</th>
              <td mat-cell *matCellDef="let user">
                <span class="role-badge" [class.admin]="user.role === 'ADMIN'">
                  {{ user.role }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="enabled">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
              <td mat-cell *matCellDef="let user">
                <span class="status-badge" [class.active]="user.enabled">
                  {{ user.enabled ? 'Active' : 'Disabled' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">Actions</th>
              <td mat-cell *matCellDef="let user" class="actions-column">
                <button mat-icon-button color="primary" (click)="openEditDialog(user)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  (click)="deleteUser(user)"
                  [disabled]="isCurrentUser(user)"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>

          <mat-paginator
            [length]="totalElements"
            [pageIndex]="page"
            [pageSize]="size"
            [pageSizeOptions]="[5, 10, 25, 50]"
            (page)="onPageChange($event)"
            showFirstLastButtons
          />
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

    .toolbar {
      margin-bottom: 20px;
    }

    .full-width {
      width: 100%;
    }

    mat-card {
      border-radius: var(--app-radius-md);
      overflow: hidden;
    }

    .username-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }

    .user-icon {
      color: var(--app-on-surface-variant);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .role-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: var(--app-line-badge-radius);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background-color: var(--app-surface-variant);
      color: var(--app-on-surface-variant);
    }

    .role-badge.admin {
      background-color: var(--app-info-container);
      color: var(--app-on-info-container);
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: var(--app-line-badge-radius);
      font-size: 12px;
      font-weight: 600;
      background-color: var(--app-critical-container);
      color: var(--app-on-critical-container);
    }

    .status-badge.active {
      background-color: var(--app-success-container);
      color: var(--app-on-success-container);
    }

    .actions-column {
      text-align: right;
      width: var(--app-actions-column-width);
    }
  `,
})
export class UsersComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  readonly sort = viewChild(MatSort);
  loading = signal(true);
  dataSource = new MatTableDataSource<User>([]);
  displayedColumns = ['username', 'role', 'enabled', 'actions'];

  // Pagination state
  page = 0;
  size = 10;
  sortBy = 'username';
  sortDir: 'asc' | 'desc' = 'asc';
  search = '';
  totalElements = 0;

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.page = params['page'] ? +params['page'] : 0;
      this.size = params['size'] ? +params['size'] : 10;
      this.sortBy = params['sortBy'] || 'username';
      this.sortDir = params['sortDir'] === 'desc' ? 'desc' : 'asc';
      this.search = params['search'] || '';
      this.loadUsers();
    });
  }

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      sortRef.active = this.sortBy;
      sortRef.direction = this.sortDir;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.userService
      .getAllPaginated({
        page: this.page,
        size: this.size,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        search: this.search || undefined,
      })
      .subscribe({
        next: (response: PageResponse<User>) => {
          this.dataSource.data = response.content;
          this.totalElements = response.totalElements;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          const message = err.error?.message || 'Failed to load users';
          this.snackBar.open(message, 'Close', { duration: 5000 });
        },
      });
  }

  updateUrl(): void {
    const queryParams: Record<string, string | number> = {};
    if (this.page > 0) queryParams['page'] = this.page;
    if (this.size !== 10) queryParams['size'] = this.size;
    if (this.sortBy !== 'username') queryParams['sortBy'] = this.sortBy;
    if (this.sortDir !== 'asc') queryParams['sortDir'] = this.sortDir;
    if (this.search) queryParams['search'] = this.search;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex;
    this.size = event.pageSize;
    this.updateUrl();
  }

  onSortChange(event: Sort): void {
    this.sortBy = event.active;
    this.sortDir = event.direction === 'desc' ? 'desc' : 'asc';
    this.page = 0;
    this.updateUrl();
  }

  onSearchChange(search: string): void {
    this.search = search;
    this.page = 0;
    this.updateUrl();
  }

  isCurrentUser(user: User): boolean {
    return this.authService.currentUser()?.username === user.username;
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      data: { isEdit: false } as UserDialogData,
      width: '450px',
      ariaLabel: 'Create new user',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.userService.create(result).subscribe({
          next: () => {
            this.loadUsers();
            this.snackBar.open('User created', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to create user';
            this.snackBar.open(message, 'Close', {
              duration: 5000,
              panelClass: 'error-snackbar',
            });
          },
        });
      }
    });
  }

  openEditDialog(user: User): void {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      data: { user, isEdit: true } as UserDialogData,
      width: '450px',
      ariaLabel: `Edit user ${user.username}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.userService.update(user.id, result).subscribe({
          next: () => {
            this.loadUsers();
            this.snackBar.open('User updated', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to update user';
            this.snackBar.open(message, 'Close', {
              duration: 5000,
              panelClass: 'error-snackbar',
            });
          },
        });
      }
    });
  }

  deleteUser(user: User): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete User',
        message: `Delete user "${user.username}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of user ${user.username}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.userService.delete(user.id).subscribe({
          next: () => {
            this.loadUsers();
            this.snackBar.open('User deleted', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to delete user';
            this.snackBar.open(message, 'Close', {
              duration: 5000,
              panelClass: 'error-snackbar',
            });
          },
        });
      }
    });
  }
}
