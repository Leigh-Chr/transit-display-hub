import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { UserService } from '@core/api/user.service';
import { AuthService } from '@core/auth/auth.service';
import { User, PageResponse, CreateUserRequest, UpdateUserRequest } from '@shared/models';
import { UserDialogComponent } from './user-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';

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
    MatTooltipModule,
    TableSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminTableState],
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
          [initialValue]="tableState.search"
          (searchChange)="tableState.onSearchChange($event)"
        />
      </div>

      @if (loading()) {
        <app-table-skeleton
          [rows]="4"
          [columns]="[{ width: '150px' }, { width: '100px' }, { width: '80px' }, { width: '80px' }]"
        />
      } @else if (dataSource.data.length === 0 && !tableState.search) {
        <mat-card animate.enter="fade-in">
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
      } @else if (dataSource.data.length === 0 && tableState.search) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="search_off"
            title="No results found"
            description="Try adjusting your search terms."
          />
        </mat-card>
      } @else {
        <mat-card animate.enter="fade-in">
          <table mat-table [dataSource]="dataSource" matSort (matSortChange)="tableState.onSortChange($event)" class="full-width">
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
                <button mat-icon-button color="primary" (click)="openEditDialog(user)" aria-label="Edit user">
                  <mat-icon aria-hidden="true">edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  (click)="deleteUser(user)"
                  [disabled]="isCurrentUser(user) || isLastEnabledAdmin(user)"
                  [matTooltip]="
                    isCurrentUser(user) ? 'You cannot delete your own account' :
                    isLastEnabledAdmin(user) ? 'Cannot delete the last enabled admin' : 'Delete user'
                  "
                  aria-label="Delete user"
                >
                  <mat-icon aria-hidden="true">delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>

          <mat-paginator
            [length]="totalElements"
            [pageIndex]="tableState.page"
            [pageSize]="tableState.size"
            [pageSizeOptions]="[5, 10, 25, 50]"
            (page)="tableState.onPageChange($event)"
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

    /* Enter animations */
    /* Enter animations defined globally — see styles.scss section 13a */
  `,
})
export class UsersComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  readonly tableState = inject(AdminTableState);
  readonly sort = viewChild(MatSort);
  loading = signal(true);
  dataSource = new MatTableDataSource<User>([]);
  displayedColumns = ['username', 'role', 'enabled', 'actions'];

  totalElements = 0;

  ngOnInit(): void {
    this.tableState.init({ sortBy: 'username' });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.tableState.syncFromQueryParams(params);
      this.loadUsers();
    });
  }

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      sortRef.active = this.tableState.sortBy;
      sortRef.direction = this.tableState.sortDir;
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
        page: this.tableState.page,
        size: this.tableState.size,
        sortBy: this.tableState.sortBy,
        sortDir: this.tableState.sortDir,
        search: this.tableState.search || undefined,
      })
      .subscribe({
        next: (response: PageResponse<User>) => {
          if (response.content.length === 0 && this.tableState.page > 0 && response.totalElements > 0) {
            this.tableState.page = Math.max(0, response.totalPages - 1);
            this.tableState.updateUrl();
            this.loadUsers();
            return;
          }
          this.dataSource.data = response.content;
          this.totalElements = response.totalElements;
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const httpErr = err as { error?: { message?: string } };
          const message = httpErr.error?.message ?? 'Failed to load users';
          this.snackBar.open(message, 'Close', { duration: 5000 });
        },
      });
  }

  isCurrentUser(user: User): boolean {
    return this.authService.currentUser()?.username === user.username;
  }

  /** Best-effort frontend guard against locking the system out. The backend
   *  remains authoritative — this only blocks the obvious case where the
   *  current page already shows a single enabled admin. Multi-page scenarios
   *  still rely on the server's rejection. */
  isLastEnabledAdmin(user: User): boolean {
    if (user.role !== 'ADMIN' || !user.enabled) { return false; }
    const enabledAdminsOnPage = this.dataSource.data.filter(
      u => u.role === 'ADMIN' && u.enabled,
    );
    return enabledAdminsOnPage.length === 1 && enabledAdminsOnPage[0]?.id === user.id;
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      data: { isEdit: false },
      width: '450px',
      ariaLabel: 'Create new user',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.userService.create(result as CreateUserRequest).subscribe({
          next: () => {
            this.tableState.resetToFirstPage();
            this.loadUsers();
            this.snackBar.open('User created', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const httpErr = err as { error?: { message?: string } };
            const message = httpErr.error?.message ?? 'Failed to create user';
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
      data: { user, isEdit: true },
      width: '450px',
      ariaLabel: `Edit user ${user.username}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.userService.update(user.id, result as UpdateUserRequest).subscribe({
          next: () => {
            this.loadUsers();
            this.snackBar.open('User updated', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const httpErr = err as { error?: { message?: string } };
            const message = httpErr.error?.message ?? 'Failed to update user';
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
      },
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
          error: (err: unknown) => {
            const httpErr = err as { error?: { message?: string } };
            const message = httpErr.error?.message ?? 'Failed to delete user';
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
