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
import { AdminPageHeaderComponent } from '@shared/components/admin-page-header/admin-page-header.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { createAdminListResource } from '@shared/admin/admin-list-resource';
import { confirmAndDelete } from '@shared/admin/confirm-and-delete';
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
    AdminPageHeaderComponent,
    StatusBadgeComponent,
    TableSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminTableState],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
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
    confirmAndDelete(
      { dialog: this.dialog, transloco: this.transloco, notify: this.notify },
      {
        titleKey: 'admin.users.confirm.deleteTitle',
        messageKey: 'admin.users.confirm.deleteMessage',
        messageArgs: { username: user.username },
        successKey: 'admin.users.deleteSuccess',
        errorKey: 'admin.users.deleteFailed',
        delete$: () => this.userService.delete(user.id),
        onSuccess: () => this.loadUsers(),
      },
    );
  }
}
