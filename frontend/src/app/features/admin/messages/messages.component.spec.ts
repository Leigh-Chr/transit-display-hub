import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessagesComponent } from './messages.component';
import { MessageService } from '@core/api/message.service';
import { LineService } from '@core/api/line.service';
import { BroadcastMessage, Line, PageResponse } from '@shared/models';

describe('MessagesComponent', () => {
  let component: MessagesComponent;
  let fixture: ComponentFixture<MessagesComponent>;
  let mockMessageService: {
    getAllPaginated: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLineService: {
    getAll: ReturnType<typeof vi.fn>;
  };
  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let queryParamsSubject: Subject<Record<string, string>>;

  const now = new Date();
  const pastHour = new Date(now.getTime() - 3600000).toISOString();
  const futureHour = new Date(now.getTime() + 3600000).toISOString();

  const mockMessage: BroadcastMessage = {
    id: 'm1',
    title: 'Alert',
    content: 'Test',
    severity: 'CRITICAL',
    startTime: pastHour,
    endTime: futureHour,
    scopeType: 'NETWORK',
    scopeId: null,
    scopeInfo: null,
    active: true,
  };

  const mockLine: Line = {
    id: 'l1',
    code: 'L1',
    name: 'Metro Line 1',
    color: '#FF0000',
    type: 'METRO',
    stopCount: 5,
    itineraryCount: 2,
  };

  const mockPageResponse: PageResponse<BroadcastMessage> = {
    content: [mockMessage],
    page: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
  };

  beforeEach(() => {
    queryParamsSubject = new Subject<Record<string, string>>();

    mockMessageService = {
      getAllPaginated: vi.fn().mockReturnValue(of(mockPageResponse)),
      create: vi.fn().mockReturnValue(of(mockMessage)),
      update: vi.fn().mockReturnValue(of(mockMessage)),
      delete: vi.fn().mockReturnValue(of(void 0)),
    };

    mockLineService = {
      getAll: vi.fn().mockReturnValue(of([mockLine])),
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [MessagesComponent],
      providers: [
        provideRouter([]),
        { provide: MessageService, useValue: mockMessageService },
        { provide: LineService, useValue: mockLineService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParamsSubject.asObservable() },
        },
      ],
    });

    fixture = TestBed.createComponent(MessagesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load lines and messages on init', () => {
      fixture.detectChanges();
      queryParamsSubject.next({});

      expect(mockLineService.getAll).toHaveBeenCalled();
      expect(component.lines()).toEqual([mockLine]);
      expect(mockMessageService.getAllPaginated).toHaveBeenCalled();
      expect(component.messages()).toEqual([mockMessage]);
    });
  });

  describe('loadMessages', () => {
    it('should call getAllPaginated with correct params', () => {
      fixture.detectChanges();
      queryParamsSubject.next({});

      expect(mockMessageService.getAllPaginated).toHaveBeenCalledWith({
        page: 0,
        size: 10,
        search: undefined,
        severity: undefined,
        active: undefined,
        sortBy: 'startTime',
        sortDir: 'desc',
      });
    });

    it('should pass filter params from query string', () => {
      fixture.detectChanges();
      queryParamsSubject.next({
        page: '2',
        size: '25',
        search: 'alert',
        severity: 'CRITICAL',
        active: 'true',
      });

      expect(mockMessageService.getAllPaginated).toHaveBeenCalledWith({
        page: 2,
        size: 25,
        search: 'alert',
        severity: 'CRITICAL',
        active: true,
        sortBy: 'startTime',
        sortDir: 'desc',
      });
    });

    it('should handle error by setting loading to false and showing snackbar', () => {
      mockMessageService.getAllPaginated = vi.fn().mockReturnValue(
        throwError(() => ({ error: { message: 'Server error' } })),
      );

      fixture.detectChanges();
      queryParamsSubject.next({});

      expect(component.loading()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith('Server error', 'Close', {
        duration: 5000,
        panelClass: 'error-snackbar',
      });
    });

    it('should show fallback error message when error has no message', () => {
      mockMessageService.getAllPaginated = vi.fn().mockReturnValue(
        throwError(() => ({ error: {} })),
      );

      fixture.detectChanges();
      queryParamsSubject.next({});

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to load messages',
        'Close',
        { duration: 5000, panelClass: 'error-snackbar' },
      );
    });
  });

  describe('onSeverityChange', () => {
    it('should set severity, reset page, and update URL', () => {
      fixture.detectChanges();
      queryParamsSubject.next({});

      component.page = 3;
      component.onSeverityChange('WARNING');

      expect(component.severity).toBe('WARNING');
      expect(component.page).toBe(0);
      expect(mockRouter.navigate).toHaveBeenCalled();
    });
  });

  describe('onActiveChange', () => {
    it('should set showActiveOnly, reset page, and update URL', () => {
      fixture.detectChanges();
      queryParamsSubject.next({});

      component.page = 5;
      component.onActiveChange(true);

      expect(component.showActiveOnly).toBe(true);
      expect(component.page).toBe(0);
      expect(mockRouter.navigate).toHaveBeenCalled();
    });
  });

  describe('isActive', () => {
    it('should return true for a currently active message', () => {
      const activeMessage: BroadcastMessage = {
        ...mockMessage,
        startTime: pastHour,
        endTime: futureHour,
      };

      expect(component.isActive(activeMessage)).toBe(true);
    });

    it('should return false for a past message', () => {
      const pastMessage: BroadcastMessage = {
        ...mockMessage,
        startTime: new Date(now.getTime() - 7200000).toISOString(),
        endTime: pastHour,
      };

      expect(component.isActive(pastMessage)).toBe(false);
    });

    it('should return false for a future message', () => {
      const futureMessage: BroadcastMessage = {
        ...mockMessage,
        startTime: futureHour,
        endTime: new Date(now.getTime() + 7200000).toISOString(),
      };

      expect(component.isActive(futureMessage)).toBe(false);
    });
  });

  describe('openCreateDialog', () => {
    it('should pass lines in dialog data', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });

      fixture.detectChanges();
      queryParamsSubject.next({});

      component.openCreateDialog();
      dialogCloseSubject.next(null);

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: { lines: [mockLine] },
          width: '500px',
        }),
      );
    });

    it('should create message and reload on dialog success', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });

      fixture.detectChanges();
      queryParamsSubject.next({});
      mockMessageService.getAllPaginated.mockClear();

      component.openCreateDialog();
      dialogCloseSubject.next({ title: 'New', content: 'Body', severity: 'INFO' });

      expect(mockMessageService.create).toHaveBeenCalledWith({
        title: 'New',
        content: 'Body',
        severity: 'INFO',
      });
      expect(mockMessageService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Message created', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not create when dialog is cancelled', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });

      component.openCreateDialog();
      dialogCloseSubject.next(null);

      expect(mockMessageService.create).not.toHaveBeenCalled();
    });
  });

  describe('openEditDialog', () => {
    it('should update message and reload on dialog success', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });

      fixture.detectChanges();
      queryParamsSubject.next({});
      mockMessageService.getAllPaginated.mockClear();

      component.openEditDialog(mockMessage);
      dialogCloseSubject.next({ title: 'Updated', content: 'Updated body', severity: 'WARNING' });

      expect(mockMessageService.update).toHaveBeenCalledWith('m1', {
        title: 'Updated',
        content: 'Updated body',
        severity: 'WARNING',
      });
      expect(mockMessageService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Message updated', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should pass message and lines in dialog data', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });

      fixture.detectChanges();
      queryParamsSubject.next({});

      component.openEditDialog(mockMessage);
      dialogCloseSubject.next(null);

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: { message: mockMessage, lines: [mockLine] },
          width: '500px',
        }),
      );
    });
  });

  describe('deleteMessage', () => {
    it('should delete message when confirmed', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });

      fixture.detectChanges();
      queryParamsSubject.next({});
      mockMessageService.getAllPaginated.mockClear();

      component.deleteMessage(mockMessage);
      dialogCloseSubject.next(true);

      expect(mockMessageService.delete).toHaveBeenCalledWith('m1');
      expect(mockMessageService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Message deleted', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not delete message when cancelled', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });

      component.deleteMessage(mockMessage);
      dialogCloseSubject.next(false);

      expect(mockMessageService.delete).not.toHaveBeenCalled();
    });
  });
});
