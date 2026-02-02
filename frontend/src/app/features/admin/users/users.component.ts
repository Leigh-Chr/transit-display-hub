import { Component, OnInit, inject, signal, viewChild, AfterViewInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { UserService } from '@core/api/user.service';
import { AuthService } from '@core/auth/auth.service';
import { User } from '@shared/models';
import { UserDialogComponent, UserDialogData } from './user-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
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
    TableSkeletonComponent,
    EmptyStateComponent,
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

      @if (loading()) {
        <app-table-skeleton
          [rows]="4"
          [columns]="[{ width: '150px' }, { width: '100px' }, { width: '80px' }, { width: '80px' }]"
        />
      } @else if (dataSource.data.length === 0) {
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
      } @else {
        <mat-card @fadeIn>
          <table mat-table [dataSource]="dataSource" matSort class="full-width">
            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Username</th>
              <td mat-cell *matCellDef="let user" class="username-cell">
                <mat-icon class="user-icon">person</mat-icon>
                {{ user.username }}
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

    mat-card {
      border-radius: 12px;
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
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background-color: var(--app-surface-variant);
      color: var(--app-on-surface-variant);
    }

    .role-badge.admin {
      background-color: #e3f2fd;
      color: #1565c0;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      background-color: #ffebee;
      color: #c62828;
    }

    .status-badge.active {
      background-color: #e8f5e9;
      color: #2e7d32;
    }

    .actions-column {
      text-align: right;
      width: 120px;
    }
  `,
})
export class UsersComponent implements OnInit, AfterViewInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly sort = viewChild(MatSort);
  loading = signal(true);
  dataSource = new MatTableDataSource<User>([]);
  displayedColumns = ['username', 'role', 'enabled', 'actions'];

  ngOnInit(): void {
    this.loadUsers();
  }

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      this.dataSource.sort = sortRef;
    }
  }

  loadUsers(): void {
    this.loading.set(true);
    this.userService.getAll().subscribe({
      next: (users) => {
        this.dataSource.data = users;
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
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
