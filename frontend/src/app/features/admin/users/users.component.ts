import { ChangeDetectionStrategy, Component, inject, viewChild, AfterViewInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserService } from '@core/api/user.service';
import { AuthService } from '@core/auth/auth.service';
import { User, CreateUserRequest, UpdateUserRequest } from '@shared/models';
import { UserDialogComponent } from './user-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { createAdminListResource } from '@shared/admin/admin-list-resource';
import { httpErrorMessage } from '@shared/utils/http.utils';
import { ADMIN_PAGE_SIZE_OPTIONS } from '@shared/utils/pagination.constants';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

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
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminTableState],
  template: `
    <ng-container *transloco="let t">
    <div class="users-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.users.title') }}</h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>person_add</mat-icon>
          {{ t('admin.users.newUser') }}
        </button>
      </div>

      <div class="toolbar">
        <app-search-input
          [placeholder]="t('admin.users.searchPlaceholder')"
          [initialValue]="tableState.search"
          (searchChange)="tableState.onSearchChange($event)"
        />
      </div>

      @if (loading()) {
        <app-table-skeleton
          [rows]="4"
          [columns]="[{ width: '150px' }, { width: '100px' }, { width: '80px' }, { width: '80px' }]"
        />
      } @else if (loadError()) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="error_outline"
            [title]="t('admin.users.loadFailed')"
            [description]="t('admin.common.loadErrorDescription')"
            [actionLabel]="t('common.refresh')"
            actionIcon="refresh"
            (action)="loadUsers()"
          />
        </mat-card>
      } @else if (users().length === 0 && !tableState.search) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="people"
            iconColor="primary"
            [title]="t('admin.users.emptyTitle')"
            [description]="t('admin.users.emptyDescription')"
            [actionLabel]="t('admin.users.emptyAction')"
            actionIcon="person_add"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else if (users().length === 0 && tableState.search) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="search_off"
            [title]="t('admin.users.emptySearchTitle')"
            [description]="t('admin.users.emptySearchDescription')"
          />
        </mat-card>
      } @else {
        <mat-card animate.enter="fade-in">
          <table mat-table [dataSource]="users()" matSort (matSortChange)="tableState.onSortChange($event)" class="full-width">
            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ t('admin.users.colUsername') }}</th>
              <td mat-cell *matCellDef="let user">
                <div class="username-cell">
                  <mat-icon class="user-icon">person</mat-icon>
                  {{ user.username }}
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ t('admin.users.colRole') }}</th>
              <td mat-cell *matCellDef="let user">
                <span class="role-badge" [class.admin]="user.role === 'ADMIN'">
                  {{ user.role }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="enabled">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ t('admin.users.colStatus') }}</th>
              <td mat-cell *matCellDef="let user">
                <span class="status-badge" [class.active]="user.enabled">
                  {{ user.enabled ? t('admin.users.statusActive') : t('admin.users.statusDisabled') }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">{{ t('admin.users.colActions') }}</th>
              <td mat-cell *matCellDef="let user" class="actions-column">
                <button mat-icon-button color="primary" (click)="openEditDialog(user)" [attr.aria-label]="t('admin.users.editTooltip')">
                  <mat-icon aria-hidden="true">edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  (click)="deleteUser(user)"
                  [disabled]="isCurrentUser(user) || isLastEnabledAdmin(user)"
                  [matTooltip]="
                    isCurrentUser(user) ? t('admin.users.deleteSelfTooltip') :
                    isLastEnabledAdmin(user) ? t('admin.users.deleteLastAdminTooltip') : t('admin.users.deleteTooltip')
                  "
                  [attr.aria-label]="t('admin.users.deleteTooltip')"
                >
                  <mat-icon aria-hidden="true">delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>

          <mat-paginator
            [length]="totalElements()"
            [pageIndex]="tableState.page"
            [pageSize]="tableState.size"
            [pageSizeOptions]="pageSizeOptions"
            (page)="tableState.onPageChange($event)"
            showFirstLastButtons
          />
        </mat-card>
      }
    </div>
    </ng-container>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }

    .page-title {
      font-size: var(--m3-type-headline-large);
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
      font-size: var(--m3-type-headline-small);
      width: 20px;
      height: 20px;
    }

    .role-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: var(--app-line-badge-radius);
      font-size: var(--m3-type-label-medium);
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
      font-size: var(--m3-type-label-medium);
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
export class UsersComponent implements AfterViewInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  readonly tableState = inject(AdminTableState);
  readonly sort = viewChild(MatSort);
  protected readonly pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS;
  displayedColumns = ['username', 'role', 'enabled', 'actions'];

  private readonly list = createAdminListResource<User>({
    tableState: this.tableState,
    defaults: { sortBy: 'username' },
    fetch: (request) => this.userService.getAllPaginated(request),
  });

  readonly loading = this.list.loading;
  readonly loadError = this.list.loadError;
  readonly users = this.list.items;
  readonly totalElements = this.list.totalElements;

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      sortRef.active = this.tableState.sortBy;
      sortRef.direction = this.tableState.sortDir;
    }
  }

  loadUsers(): void {
    this.list.reload();
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
    const enabledAdminsOnPage = this.users().filter(
      u => u.role === 'ADMIN' && u.enabled,
    );
    return enabledAdminsOnPage.length === 1 && enabledAdminsOnPage[0]?.id === user.id;
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      data: {
        isEdit: false,
        submit: (request: CreateUserRequest | UpdateUserRequest) =>
          this.userService.create(request as CreateUserRequest),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.users.createFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.users.dialog.titleCreate'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.tableState.resetToFirstPage();
        this.loadUsers();
        this.notify.success(this.transloco.translate('admin.users.createSuccess'));
      }
    });
  }

  openEditDialog(user: User): void {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      data: {
        user,
        isEdit: true,
        submit: (request: CreateUserRequest | UpdateUserRequest) =>
          this.userService.update(user.id, request as UpdateUserRequest),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.users.updateFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.users.dialog.titleEdit'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadUsers();
        this.notify.success(this.transloco.translate('admin.users.updateSuccess'));
      }
    });
  }

  deleteUser(user: User): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.transloco.translate('admin.users.confirm.deleteTitle'),
        message: this.transloco.translate('admin.users.confirm.deleteMessage', { username: user.username }),
        confirmText: this.transloco.translate('common.delete'),
        cancelText: this.transloco.translate('common.cancel'),
        confirmColor: 'warn',
      },
      ariaLabel: this.transloco.translate('admin.users.confirm.deleteTitle'),
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.userService.delete(user.id).subscribe({
          next: () => {
            this.loadUsers();
            this.notify.success(this.transloco.translate('admin.users.deleteSuccess'));
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.users.deleteFailed')));
          },
        });
      }
    });
  }
}
