import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceService } from '@core/api/device.service';
import { LineService } from '@core/api/line.service';
import { Device, DeviceRegistration, Line } from '@shared/models';
import { DevicesComponent } from './devices.component';
import { testTranslocoModule } from '../../../../test-translations';

const translocoLang = {
  admin: {
    devices: {
      loadFailed: 'Failed to load devices',
      loadLinesFailed: 'Failed to load lines',
      registerFailed: 'Failed to register device',
      removeSuccess: 'Device removed',
      removeFailed: 'Failed to remove device',
      tokenCopied: 'Token copied to clipboard',
      tokenCopyFailed: 'Failed to copy token',
      tokenTitle: 'Device Registered',
      dialog: { title: 'Register New Device' },
      confirm: { removeTitle: 'Remove Device', removeMessage: 'Remove device?' },
    },
    common: { remove: 'Remove', done: 'Done' },
    navigation: {},
  },
  common: { delete: 'Delete' },
};

const translocoLangFr = {
  admin: {
    devices: {
      loadFailed: 'Échec du chargement des bornes',
      loadLinesFailed: 'Échec du chargement des lignes',
      registerFailed: "Échec de l'enregistrement de la borne",
      removeSuccess: 'Borne supprimée',
      removeFailed: 'Échec de la suppression de la borne',
      tokenCopied: 'Jeton copié dans le presse-papier',
      tokenCopyFailed: 'Échec de la copie du jeton',
      tokenTitle: 'Borne enregistrée',
      dialog: { title: 'Enregistrer une nouvelle borne' },
      confirm: { removeTitle: 'Supprimer la borne', removeMessage: 'Supprimer la borne ?' },
    },
    common: { remove: 'Supprimer', done: 'Terminé' },
    navigation: {},
  },
  common: { delete: 'Supprimer' },
};

/** rxResource bridges its initial load through queueMicrotask / async
 *  effects. Flushing a couple of microtasks + a TestBed tick gives the
 *  loader enough room to commit a value or an error to the signals. */
async function flushResource(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  TestBed.tick();
}

describe('DevicesComponent', () => {
  let component: DevicesComponent;
  let fixture: ComponentFixture<DevicesComponent>;

  const mockDevice: Device = {
    id: 'd1',
    stopId: 's1',
    stopName: 'Central',
    lines: [{ id: 'line-1', code: 'L1', name: 'Line 1', color: '#F00' }],
    status: 'ONLINE',
    lastHeartbeat: '2024-01-01T12:00:00',
  };

  const mockRegistration: DeviceRegistration = {
    id: 'd2',
    token: 'jwt-token-123',
    stopId: 's1',
    stopName: 'Central',
  };

  const mockLine: Line = {
    id: '1',
    code: 'L1',
    name: 'Line 1',
    color: '#F00',
    type: 'METRO',
    stopCount: 3,
    itineraryCount: 1,
  };

  let mockDeviceService: {
    getAll: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  let mockLineService: {
    getAll: ReturnType<typeof vi.fn>;
  };

  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };

  let mockNotify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDeviceService = {
      getAll: vi.fn().mockReturnValue(of([mockDevice])),
      register: vi.fn().mockReturnValue(of(mockRegistration)),
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
        DevicesComponent,
        testTranslocoModule(translocoLang, translocoLangFr),
      ],
      providers: [
        provideRouter([]),
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: LineService, useValue: mockLineService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: NotifyService, useValue: mockNotify },
      ],
    });

    fixture = TestBed.createComponent(DevicesComponent);
    component = fixture.componentInstance;
  });

  describe('initial load', () => {
    it('should load devices and lines', async () => {
      fixture.detectChanges();
      await flushResource();

      expect(mockDeviceService.getAll).toHaveBeenCalled();
      expect(mockLineService.getAll).toHaveBeenCalled();
      expect(component.devices()).toEqual([mockDevice]);
      expect(component.lines()).toEqual([mockLine]);
      expect(component.loading()).toBe(false);
    });
  });

  describe('loadDevices', () => {
    it('should call getAll without filter when statusFilter is empty', async () => {
      fixture.detectChanges();
      await flushResource();
      component.statusFilter.set('');
      mockDeviceService.getAll.mockClear();

      component.loadDevices();
      await flushResource();

      expect(mockDeviceService.getAll).toHaveBeenCalledWith(undefined);
      expect(component.devices()).toEqual([mockDevice]);
      expect(component.loading()).toBe(false);
    });

    it('should call getAll with status filter when statusFilter is set', async () => {
      fixture.detectChanges();
      await flushResource();
      component.statusFilter.set('ONLINE');
      mockDeviceService.getAll.mockClear();

      component.loadDevices();
      await flushResource();

      expect(mockDeviceService.getAll).toHaveBeenCalledWith('ONLINE');
    });

    it('should handle error by surfacing the load error inline', async () => {
      // Re-create the component with the failing mock in place so the
      // resource's first fetch already trips the error path.
      const error = { error: { message: 'Server error' } };
      mockDeviceService.getAll.mockReturnValue(throwError(() => error));
      fixture = TestBed.createComponent(DevicesComponent);
      component = fixture.componentInstance;

      fixture.detectChanges();
      await flushResource();

      expect(component.loading()).toBe(false);
      expect(component.loadError()).toBe('Server error');
    });

    it('should show fallback message when error has no message', async () => {
      mockDeviceService.getAll.mockReturnValue(throwError(() => ({ error: {} })));
      fixture = TestBed.createComponent(DevicesComponent);
      component = fixture.componentInstance;

      fixture.detectChanges();
      await flushResource();

      expect(component.loadError()).toBe('Failed to load devices');
    });
  });

  describe('openCreateDialog', () => {
    it('should open token dialog and reload when the dialog closes with a registration', async () => {
      fixture.detectChanges();
      await flushResource();
      mockDeviceService.getAll.mockClear();
      const afterClosed$ = new Subject<unknown>();
      // First open() call = DeviceDialogComponent; second = DeviceTokenDialogComponent
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.openCreateDialog();
      afterClosed$.next(mockRegistration);
      await flushResource();

      expect(mockDialog.open).toHaveBeenCalledTimes(2);
      expect(mockDeviceService.getAll).toHaveBeenCalled();
    });

    it('should pass a submit callback that calls deviceService.register', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.openCreateDialog();

      const passedData = mockDialog.open.mock.calls[0]![1].data;
      passedData.submit({ stopId: 's1' });
      expect(mockDeviceService.register).toHaveBeenCalledWith({ stopId: 's1' });
    });

    it('should not open the token dialog when dialog is cancelled', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.openCreateDialog();
      afterClosed$.next(undefined);

      // Only the device dialog was opened, never the token dialog
      expect(mockDialog.open).toHaveBeenCalledTimes(1);
    });

    it('should expose an onError that surfaces the failure via notify', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.openCreateDialog();
      const passedData = mockDialog.open.mock.calls[0]![1].data;
      passedData.onError({ error: { message: 'Stop already has a device' } });

      expect(mockNotify.error).toHaveBeenCalledWith('Stop already has a device');
    });

    it('should expose an onError with fallback message when error has no message', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.openCreateDialog();
      const passedData = mockDialog.open.mock.calls[0]![1].data;
      passedData.onError({ error: {} });

      expect(mockNotify.error).toHaveBeenCalledWith('Failed to register device');
    });
  });

  describe('deleteDevice', () => {
    it('should delete and reload when confirmed', async () => {
      fixture.detectChanges();
      await flushResource();
      mockDeviceService.getAll.mockClear();
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.deleteDevice(mockDevice);
      afterClosed$.next(true);
      await flushResource();

      expect(mockDeviceService.delete).toHaveBeenCalledWith('d1');
      expect(mockDeviceService.getAll).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('Device removed');
    });

    it('should skip deletion when cancelled', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.deleteDevice(mockDevice);
      afterClosed$.next(false);

      expect(mockDeviceService.delete).not.toHaveBeenCalled();
    });

    it('should show error notification on delete error', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);
      const error = { error: { message: 'Cannot remove device' } };
      mockDeviceService.delete.mockReturnValue(throwError(() => error));

      component.deleteDevice(mockDevice);
      afterClosed$.next(true);

      expect(mockNotify.error).toHaveBeenCalledWith('Cannot remove device');
    });
  });

  describe('openKioskPreview', () => {
    it('should open a new window with the display URL', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      component.openKioskPreview('s1');

      expect(openSpy).toHaveBeenCalledWith('/display/s1', '_blank');
      openSpy.mockRestore();
    });
  });
});
