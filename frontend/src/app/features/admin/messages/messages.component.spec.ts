import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessagesComponent } from './messages.component';
import { MessageService } from '@core/api/message.service';
import { LineService } from '@core/api/line.service';
import { BroadcastMessage, Line, PageResponse } from '@shared/models';
import { testTranslocoModule } from '../../../../test-translations';

async function detectAndFlush(f: ComponentFixture<unknown>): Promise<void> {
  f.detectChanges();
  await f.whenStable();
}

const en = {
  common: { delete: 'Delete' },
  admin: {
    messages: {
      loadFailed: 'Failed to load messages',
      loadLinesFailed: 'Failed to load lines',
      createSuccess: 'Message created',
      updateSuccess: 'Message updated',
      deleteSuccess: 'Message deleted',
      createFailed: 'Failed to create message',
      updateFailed: 'Failed to update message',
      deleteFailed: 'Failed to delete message',
      dialog: { titleCreate: 'New Broadcast Message', titleEdit: 'Edit Message' },
      confirm: { deleteTitle: 'Delete Message', deleteMessage: 'Delete message "{{ title }}"?' },
    },
  },
};

const fr = {
  common: { delete: 'Supprimer' },
  admin: {
    messages: {
      loadFailed: 'Échec du chargement des messages',
      loadLinesFailed: 'Échec du chargement des lignes',
      createSuccess: 'Message créé',
      updateSuccess: 'Message mis à jour',
      deleteSuccess: 'Message supprimé',
      createFailed: 'Échec de la création du message',
      updateFailed: 'Échec de la mise à jour du message',
      deleteFailed: 'Échec de la suppression du message',
      dialog: { titleCreate: 'Nouveau message de diffusion', titleEdit: 'Modifier le message' },
      confirm: { deleteTitle: 'Supprimer le message', deleteMessage: 'Supprimer le message "{{ title }}" ?' },
    },
  },
};

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
  let mockNotify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  let router: Router;
  let queryParams$: BehaviorSubject<Record<string, string>>;

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
    queryParams$ = new BehaviorSubject<Record<string, string>>({});

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

    mockNotify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      imports: [
        MessagesComponent,
        testTranslocoModule(en, fr),
      ],
      providers: [
        provideRouter([]),
        { provide: MessageService, useValue: mockMessageService },
        { provide: LineService, useValue: mockLineService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: NotifyService, useValue: mockNotify },
        { provide: ActivatedRoute, useValue: { queryParams: queryParams$ } },
      ],
    });

    fixture = TestBed.createComponent(MessagesComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  describe('initial load', () => {
    it('should load lines and messages', async () => {
      await detectAndFlush(fixture);

      expect(mockLineService.getAll).toHaveBeenCalled();
      expect(component.lines()).toEqual([mockLine]);
      expect(mockMessageService.getAllPaginated).toHaveBeenCalled();
      expect(component.messages()).toEqual([mockMessage]);
    });
  });

  describe('loadMessages', () => {
    it('should call getAllPaginated with correct default params', async () => {
      await detectAndFlush(fixture);

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

    it('should pass filter params from query string', async () => {
      queryParams$.next({
        page: '2',
        size: '25',
        search: 'alert',
        severity: 'CRITICAL',
        active: 'true',
      });
      await detectAndFlush(fixture);

      expect(mockMessageService.getAllPaginated).toHaveBeenCalledWith({
        page: 2,
        size: 25,
        search: 'alert',
        severity: 'CRITICAL',
        active: true,
        sortBy: 'startTime',
        sortDir: 'desc',
      });
      expect(component.severity()).toBe('CRITICAL');
      expect(component.showActiveOnly()).toBe(true);
    });

    it('should surface load errors via the resource error state without a snackbar', async () => {
      mockMessageService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: { message: 'Server error' } })),
      );
      await detectAndFlush(fixture);

      expect(component.loading()).toBe(false);
      expect(component.loadError()).toBeTruthy();
      expect(mockNotify.error).not.toHaveBeenCalled();
    });
  });

  describe('onSeverityChange', () => {
    it('should set severity, reset page, and update URL', async () => {
      await detectAndFlush(fixture);

      component.tableState.page = 3;
      component.onSeverityChange('WARNING');

      expect(component.severity()).toBe('WARNING');
      expect(component.tableState.page).toBe(0);
      expect(router.navigate).toHaveBeenCalled();
    });
  });

  describe('onActiveChange', () => {
    it('should set showActiveOnly, reset page, and update URL', async () => {
      await detectAndFlush(fixture);

      component.tableState.page = 5;
      component.onActiveChange(true);

      expect(component.showActiveOnly()).toBe(true);
      expect(component.tableState.page).toBe(0);
      expect(router.navigate).toHaveBeenCalled();
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
    it('should pass lines in dialog data', async () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      await detectAndFlush(fixture);

      component.openCreateDialog();
      dialogCloseSubject.next(null);

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ lines: [mockLine] }),
          width: '500px',
        }),
      );
    });

    it('should reload and notify on dialog success', async () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      await detectAndFlush(fixture);
      mockMessageService.getAllPaginated.mockClear();

      component.openCreateDialog();
      dialogCloseSubject.next(mockMessage);
      await fixture.whenStable();

      expect(mockMessageService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('Message created');
    });

    it('should pass a submit callback that calls messageService.create', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      fixture.detectChanges();

      component.openCreateDialog();

      const passedData = mockDialog.open.mock.calls[0]![1].data;
      const request = { title: 'New', content: 'Body', severity: 'INFO' };
      passedData.submit(request);
      expect(mockMessageService.create).toHaveBeenCalledWith(request);
    });

    it('should not notify success when dialog is cancelled', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      fixture.detectChanges();

      component.openCreateDialog();
      dialogCloseSubject.next(null);

      expect(mockNotify.success).not.toHaveBeenCalled();
    });

    it('should expose an onError that surfaces the failure via notify', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      fixture.detectChanges();

      component.openCreateDialog();
      const passedData = mockDialog.open.mock.calls[0]![1].data;
      passedData.onError({ error: { message: 'Boom' } });

      expect(mockNotify.error).toHaveBeenCalledWith('Boom');
    });
  });

  describe('openEditDialog', () => {
    it('should reload and notify on dialog success', async () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      await detectAndFlush(fixture);
      mockMessageService.getAllPaginated.mockClear();

      component.openEditDialog(mockMessage);
      dialogCloseSubject.next(mockMessage);
      await fixture.whenStable();

      expect(mockMessageService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('Message updated');
    });

    it('should pass a submit callback that calls messageService.update', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      fixture.detectChanges();

      component.openEditDialog(mockMessage);

      const passedData = mockDialog.open.mock.calls[0]![1].data;
      const request = { title: 'Updated', content: 'Updated body', severity: 'WARNING' };
      passedData.submit(request);
      expect(mockMessageService.update).toHaveBeenCalledWith('m1', request);
    });

    it('should pass message and lines in dialog data', async () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      await detectAndFlush(fixture);

      component.openEditDialog(mockMessage);
      dialogCloseSubject.next(null);

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ message: mockMessage, lines: [mockLine] }),
          width: '500px',
        }),
      );
    });

    it('should expose an onError that surfaces the failure via notify', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      fixture.detectChanges();

      component.openEditDialog(mockMessage);
      const passedData = mockDialog.open.mock.calls[0]![1].data;
      passedData.onError({ error: { message: 'Conflict' } });

      expect(mockNotify.error).toHaveBeenCalledWith('Conflict');
    });
  });

  describe('deleteMessage', () => {
    it('should delete message when confirmed', async () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      await detectAndFlush(fixture);
      mockMessageService.getAllPaginated.mockClear();

      component.deleteMessage(mockMessage);
      dialogCloseSubject.next(true);
      await fixture.whenStable();

      expect(mockMessageService.delete).toHaveBeenCalledWith('m1');
      expect(mockMessageService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('Message deleted');
    });

    it('should not delete message when cancelled', () => {
      const dialogCloseSubject = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => dialogCloseSubject.asObservable() });
      fixture.detectChanges();

      component.deleteMessage(mockMessage);
      dialogCloseSubject.next(false);

      expect(mockMessageService.delete).not.toHaveBeenCalled();
    });
  });
});
