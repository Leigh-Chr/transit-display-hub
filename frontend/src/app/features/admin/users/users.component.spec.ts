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

  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };

  let mockRoute: {
    queryParams: BehaviorSubject<Record<string, string>>;
  };

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

    mockRouter = {
      navigate: vi.fn(),
    };

    mockRoute = {
      queryParams: queryParams$,
    };

    TestBed.configureTestingModule({
      imports: [
        UsersComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: translocoLang, fr: translocoLang },
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
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    });

    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with loading true', () => {
    expect(component.loading()).toBe(true);
  });

  describe('loadUsers', () => {
    it('should call getAllPaginated with correct default params on init', () => {
      component.ngOnInit();

      expect(mockUserService.getAllPaginated).toHaveBeenCalledWith({
        page: 0,
        size: 10,
        sortBy: 'username',
        sortDir: 'asc',
        search: undefined,
      });
    });

    it('should populate dataSource and totalElements from response', () => {
      component.ngOnInit();

      expect(component.dataSource.data).toEqual([mockUser, mockOtherUser]);
      expect(component.totalElements).toBe(2);
    });

    it('should set loading to false after successful load', () => {
      component.ngOnInit();

      expect(component.loading()).toBe(false);
    });

    it('should read query params to set pagination state', () => {
      queryParams$.next({ page: '2', size: '25', sortBy: 'role', sortDir: 'desc', search: 'test' });
      component.ngOnInit();

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

    it('should set loading to false and show error on error', () => {
      const error = { error: { message: 'Server error' } };
      mockUserService.getAllPaginated.mockReturnValue(throwError(() => error));

      component.ngOnInit();

      expect(component.loading()).toBe(false);
      expect(mockNotify.error).toHaveBeenCalledWith('Server error');
    });

    it('should show fallback error message when error has no message', () => {
      mockUserService.getAllPaginated.mockReturnValue(throwError(() => ({ error: {} })));

      component.ngOnInit();

      expect(mockNotify.error).toHaveBeenCalledWith('Failed to load users');
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
    it('should create user and reload on dialog success', () => {
      const afterClosed$ = of({ username: 'newuser', password: 'pass123', role: 'AGENT' });
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.openCreateDialog();

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockUserService.create).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'pass123',
        role: 'AGENT',
      });
      expect(mockUserService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('User created');
    });

    it('should do nothing when dialog is cancelled', () => {
      const afterClosed$ = of(undefined);
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.openCreateDialog();

      expect(mockUserService.create).not.toHaveBeenCalled();
    });

    it('should show error when API create fails', () => {
      const afterClosed$ = of({ username: 'newuser', password: 'pass123', role: 'AGENT' });
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      mockUserService.create.mockReturnValue(
        throwError(() => ({ error: { message: 'Username already exists' } }))
      );

      component.openCreateDialog();

      expect(mockNotify.error).toHaveBeenCalledWith('Username already exists');
    });

    it('should show fallback error message when API error has no message', () => {
      const afterClosed$ = of({ username: 'newuser', password: 'pass123', role: 'AGENT' });
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      mockUserService.create.mockReturnValue(throwError(() => ({ error: {} })));

      component.openCreateDialog();

      expect(mockNotify.error).toHaveBeenCalledWith('Failed to create user');
    });
  });

  describe('openEditDialog', () => {
    it('should update user and reload on dialog success', () => {
      const updateData = { role: 'ADMIN', enabled: true };
      const afterClosed$ = of(updateData);
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.openEditDialog(mockOtherUser);

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockUserService.update).toHaveBeenCalledWith(mockOtherUser.id, updateData);
      expect(mockUserService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('User updated');
    });

    it('should do nothing when edit dialog is cancelled', () => {
      const afterClosed$ = of(undefined);
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.openEditDialog(mockOtherUser);

      expect(mockUserService.update).not.toHaveBeenCalled();
    });

    it('should show error when API update fails', () => {
      const afterClosed$ = of({ role: 'ADMIN', enabled: true });
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      mockUserService.update.mockReturnValue(
        throwError(() => ({ error: { message: 'Update failed' } }))
      );

      component.openEditDialog(mockOtherUser);

      expect(mockNotify.error).toHaveBeenCalledWith('Update failed');
    });
  });

  describe('search triggers reload', () => {
    it('should reload users with search param when query params change', () => {
      component.ngOnInit();
      mockUserService.getAllPaginated.mockClear();

      queryParams$.next({ search: 'agent' });

      expect(component.tableState.search).toBe('agent');
      expect(mockUserService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'agent' }),
      );
    });
  });

  describe('pagination triggers reload', () => {
    it('should reload users when page param changes', () => {
      component.ngOnInit();
      mockUserService.getAllPaginated.mockClear();

      queryParams$.next({ page: '2', size: '25' });

      expect(component.tableState.page).toBe(2);
      expect(component.tableState.size).toBe(25);
      expect(mockUserService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, size: 25 }),
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user and reload when confirmed', () => {
      const afterClosed$ = of(true);
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.deleteUser(mockOtherUser);

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockUserService.delete).toHaveBeenCalledWith(mockOtherUser.id);
      expect(mockUserService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('User deleted');
    });

    it('should not delete when dialog is cancelled', () => {
      const afterClosed$ = of(false);
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.deleteUser(mockOtherUser);

      expect(mockUserService.delete).not.toHaveBeenCalled();
    });

    it('should show error when API delete fails', () => {
      const afterClosed$ = of(true);
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      mockUserService.delete.mockReturnValue(
        throwError(() => ({ error: { message: 'Cannot delete last admin' } }))
      );

      component.deleteUser(mockOtherUser);

      expect(mockNotify.error).toHaveBeenCalledWith('Cannot delete last admin');
    });
  });
});
