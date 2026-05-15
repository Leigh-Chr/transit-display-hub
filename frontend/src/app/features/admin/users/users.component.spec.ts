import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersComponent } from './users.component';
import { UserService } from '@core/api/user.service';
import { AuthService } from '@core/auth/auth.service';
import { User, PageResponse } from '@shared/models';
import { TranslocoTestingModule } from '@jsverse/transloco';

async function detectAndFlush(f: ComponentFixture<unknown>): Promise<void> {
  f.detectChanges();
  await f.whenStable();
}

const translocoLang = {
  admin: {
    users: {
      loadFailed: 'Failed to load users',
      createSuccess: 'User created',
      updateSuccess: 'User updated',
      deleteSuccess: 'User deleted',
      createFailed: 'Failed to create user',
      updateFailed: 'Failed to update user',
      deleteFailed: 'Failed to delete user',
      confirm: { deleteTitle: 'Delete User', deleteMessage: 'Delete user?' },
    },
    common: {},
    navigation: {},
  },
  common: { delete: 'Delete' },
};

const translocoLangFr = {
  admin: {
    users: {
      loadFailed: 'Échec du chargement des utilisateurs',
      createSuccess: 'Utilisateur créé',
      updateSuccess: 'Utilisateur mis à jour',
      deleteSuccess: 'Utilisateur supprimé',
      createFailed: "Échec de la création de l'utilisateur",
      updateFailed: "Échec de la mise à jour de l'utilisateur",
      deleteFailed: "Échec de la suppression de l'utilisateur",
      confirm: { deleteTitle: "Supprimer l'utilisateur", deleteMessage: "Supprimer l'utilisateur ?" },
    },
    common: {},
    navigation: {},
  },
  common: { delete: 'Supprimer' },
};

const mockUser: User = { id: '1', username: 'admin', role: 'ADMIN', enabled: true };
const mockOtherUser: User = { id: '2', username: 'agent', role: 'AGENT', enabled: true };

const mockPageResponse: PageResponse<User> = {
  content: [mockUser, mockOtherUser],
  page: 0,
  size: 10,
  totalElements: 2,
  totalPages: 1,
  first: true,
  last: true,
};

describe('UsersComponent', () => {
  let component: UsersComponent;
  let fixture: ComponentFixture<UsersComponent>;
  let queryParams$: BehaviorSubject<Record<string, string>>;

  let mockUserService: {
    getAllPaginated: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  let mockAuthService: {
    currentUser: ReturnType<typeof signal>;
    isAdmin: ReturnType<typeof signal>;
  };

  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };

  let mockNotify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  let router: Router;

  beforeEach(() => {
    queryParams$ = new BehaviorSubject<Record<string, string>>({});

    mockUserService = {
      getAllPaginated: vi.fn().mockReturnValue(of(mockPageResponse)),
      create: vi.fn().mockReturnValue(of(mockUser)),
      update: vi.fn().mockReturnValue(of(mockUser)),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    mockAuthService = {
      currentUser: signal({ username: 'admin', role: 'ADMIN' }),
      isAdmin: signal(true),
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockNotify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      imports: [
        UsersComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: translocoLang, fr: translocoLangFr },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: mockUserService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: NotifyService, useValue: mockNotify },
        { provide: ActivatedRoute, useValue: { queryParams: queryParams$ } },
      ],
    });

    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be loading after detectChanges (resource initiated)', () => {
    fixture.detectChanges();
    expect(component.loading()).toBe(true);
  });

  describe('loadUsers', () => {
    it('should call getAllPaginated with correct default params', async () => {
      await detectAndFlush(fixture);

      expect(mockUserService.getAllPaginated).toHaveBeenCalledWith({
        page: 0,
        size: 10,
        sortBy: 'username',
        sortDir: 'asc',
        search: undefined,
      });
    });

    it('should populate users and totalElements from response', async () => {
      await detectAndFlush(fixture);

      expect(component.users()).toEqual([mockUser, mockOtherUser]);
      expect(component.totalElements()).toBe(2);
    });

    it('should set loading to false after successful load', async () => {
      await detectAndFlush(fixture);

      expect(component.loading()).toBe(false);
    });

    it('should read query params to set pagination state', async () => {
      queryParams$.next({ page: '2', size: '25', sortBy: 'role', sortDir: 'desc', search: 'test' });
      await detectAndFlush(fixture);

      expect(component.tableState.page).toBe(2);
      expect(component.tableState.size).toBe(25);
      expect(component.tableState.sortBy).toBe('role');
      expect(component.tableState.sortDir).toBe('desc');
      expect(component.tableState.search).toBe('test');
      expect(mockUserService.getAllPaginated).toHaveBeenCalledWith({
        page: 2,
        size: 25,
        sortBy: 'role',
        sortDir: 'desc',
        search: 'test',
      });
    });

    it('should surface load errors via the resource error state without a snackbar', async () => {
      mockUserService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: { message: 'Server error' } })),
      );
      await detectAndFlush(fixture);

      expect(component.loading()).toBe(false);
      expect(component.loadError()).toBeTruthy();
      expect(mockNotify.error).not.toHaveBeenCalled();
    });

    it('should render the error empty-state in the template when the resource errors', async () => {
      mockUserService.getAllPaginated.mockReturnValue(throwError(() => ({ error: {} })));
      await detectAndFlush(fixture);

      const errorState = fixture.nativeElement.querySelector('app-empty-state[icon="error_outline"]');
      expect(errorState).toBeTruthy();
    });
  });

  describe('isCurrentUser', () => {
    it('should return true when the user matches the current authenticated user', () => {
      expect(component.isCurrentUser(mockUser)).toBe(true);
    });

    it('should return false when the user does not match the current authenticated user', () => {
      expect(component.isCurrentUser(mockOtherUser)).toBe(false);
    });
  });

  describe('openCreateDialog', () => {
    it('should reload and notify on dialog success', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(mockUser) });
      await detectAndFlush(fixture);
      mockUserService.getAllPaginated.mockClear();

      component.openCreateDialog();
      await fixture.whenStable();

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockUserService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('User created');
    });

    it('should pass a submit callback that calls userService.create', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openCreateDialog();

      const passedData = mockDialog.open.mock.calls[0]![1].data;
      const request = { username: 'newuser', password: 'pass123', role: 'AGENT' };
      passedData.submit(request);
      expect(mockUserService.create).toHaveBeenCalledWith(request);
    });

    it('should not notify success when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openCreateDialog();

      expect(mockNotify.success).not.toHaveBeenCalled();
    });

    it('should expose an onError that surfaces the failure via notify', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openCreateDialog();
      const passedData = mockDialog.open.mock.calls[0]![1].data;
      passedData.onError({ error: { message: 'Username already exists' } });

      expect(mockNotify.error).toHaveBeenCalledWith('Username already exists');
    });

    it('should expose an onError with fallback message when error has no message', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openCreateDialog();
      const passedData = mockDialog.open.mock.calls[0]![1].data;
      passedData.onError({ error: {} });

      expect(mockNotify.error).toHaveBeenCalledWith('Failed to create user');
    });
  });

  describe('openEditDialog', () => {
    it('should reload and notify on dialog success', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(mockUser) });
      await detectAndFlush(fixture);
      mockUserService.getAllPaginated.mockClear();

      component.openEditDialog(mockOtherUser);
      await fixture.whenStable();

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockUserService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('User updated');
    });

    it('should pass a submit callback that calls userService.update', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openEditDialog(mockOtherUser);

      const passedData = mockDialog.open.mock.calls[0]![1].data;
      const request = { role: 'ADMIN', enabled: true };
      passedData.submit(request);
      expect(mockUserService.update).toHaveBeenCalledWith(mockOtherUser.id, request);
    });

    it('should not notify success when edit dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openEditDialog(mockOtherUser);

      expect(mockNotify.success).not.toHaveBeenCalled();
    });

    it('should expose an onError that surfaces the failure via notify', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openEditDialog(mockOtherUser);
      const passedData = mockDialog.open.mock.calls[0]![1].data;
      passedData.onError({ error: { message: 'Update failed' } });

      expect(mockNotify.error).toHaveBeenCalledWith('Update failed');
    });
  });

  describe('search triggers reload', () => {
    it('should reload users with search param when query params change', async () => {
      await detectAndFlush(fixture);
      mockUserService.getAllPaginated.mockClear();

      queryParams$.next({ search: 'agent' });
      await fixture.whenStable();

      expect(component.tableState.search).toBe('agent');
      expect(mockUserService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'agent' }),
      );
    });
  });

  describe('pagination triggers reload', () => {
    it('should reload users when page param changes', async () => {
      await detectAndFlush(fixture);
      mockUserService.getAllPaginated.mockClear();

      queryParams$.next({ page: '2', size: '25' });
      await fixture.whenStable();

      expect(component.tableState.page).toBe(2);
      expect(component.tableState.size).toBe(25);
      expect(mockUserService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, size: 25 }),
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user and reload when confirmed', async () => {
      const afterClosed$ = of(true);
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      await detectAndFlush(fixture);
      mockUserService.getAllPaginated.mockClear();

      component.deleteUser(mockOtherUser);
      await fixture.whenStable();

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockUserService.delete).toHaveBeenCalledWith(mockOtherUser.id);
      expect(mockUserService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('User deleted');
    });

    it('should not delete when dialog is cancelled', () => {
      const afterClosed$ = of(false);
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      fixture.detectChanges();

      component.deleteUser(mockOtherUser);

      expect(mockUserService.delete).not.toHaveBeenCalled();
    });

    it('should show error when API delete fails', () => {
      const afterClosed$ = of(true);
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      mockUserService.delete.mockReturnValue(
        throwError(() => ({ error: { message: 'Cannot delete last admin' } }))
      );
      fixture.detectChanges();

      component.deleteUser(mockOtherUser);

      expect(mockNotify.error).toHaveBeenCalledWith('Cannot delete last admin');
    });
  });
});
