import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceService } from '@core/api/device.service';
import { LineService } from '@core/api/line.service';
import { Device, DeviceRegistration, Line } from '@shared/models';
import { DevicesComponent } from './devices.component';

describe('DevicesComponent', () => {
  let component: DevicesComponent;
  let fixture: ComponentFixture<DevicesComponent>;

  const mockDevice: Device = {
    id: 'd1',
    stopId: 's1',
    stopName: 'Central',
    lines: [{ code: 'L1', name: 'Line 1', color: '#F00' }],
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

  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

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

    mockSnackBar = {
      open: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [DevicesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: LineService, useValue: mockLineService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    fixture = TestBed.createComponent(DevicesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load devices and lines', () => {
      fixture.detectChanges();

      expect(mockDeviceService.getAll).toHaveBeenCalled();
      expect(mockLineService.getAll).toHaveBeenCalled();
      expect(component.devices()).toEqual([mockDevice]);
      expect(component.lines()).toEqual([mockLine]);
      expect(component.loading()).toBe(false);
    });
  });

  describe('loadDevices', () => {
    it('should call getAll without filter when statusFilter is empty', () => {
      component.statusFilter = '';

      component.loadDevices();

      expect(mockDeviceService.getAll).toHaveBeenCalledWith(undefined);
      expect(component.devices()).toEqual([mockDevice]);
      expect(component.loading()).toBe(false);
    });

    it('should call getAll with status filter when statusFilter is set', () => {
      component.statusFilter = 'ONLINE';

      component.loadDevices();

      expect(mockDeviceService.getAll).toHaveBeenCalledWith('ONLINE');
    });

    it('should handle error by showing snackbar', () => {
      const error = { error: { message: 'Server error' } };
      mockDeviceService.getAll.mockReturnValue(throwError(() => error));

      component.loadDevices();

      expect(component.loading()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith('Server error', 'Close', { duration: 5000 });
    });

    it('should show fallback message when error has no message', () => {
      mockDeviceService.getAll.mockReturnValue(throwError(() => ({ error: {} })));

      component.loadDevices();

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to load devices', 'Close', { duration: 5000 });
    });
  });

  describe('openCreateDialog', () => {
    it('should set newDeviceToken and reload on success', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.openCreateDialog();
      afterClosed$.next({ stopId: 's1' });

      expect(mockDeviceService.register).toHaveBeenCalledWith({ stopId: 's1' });
      expect(component.newDeviceToken()).toBe('jwt-token-123');
      expect(mockDeviceService.getAll).toHaveBeenCalled();
    });

    it('should do nothing when dialog is cancelled', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.openCreateDialog();
      afterClosed$.next(undefined);

      expect(mockDeviceService.register).not.toHaveBeenCalled();
    });

    it('should show snackbar on registration error', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);
      const error = { error: { message: 'Stop already has a device' } };
      mockDeviceService.register.mockReturnValue(throwError(() => error));

      component.openCreateDialog();
      afterClosed$.next({ stopId: 's1' });

      expect(mockSnackBar.open).toHaveBeenCalledWith('Stop already has a device', 'Close', { duration: 5000 });
    });

    it('should show fallback message on registration error without message', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);
      mockDeviceService.register.mockReturnValue(throwError(() => ({ error: {} })));

      component.openCreateDialog();
      afterClosed$.next({ stopId: 's1' });

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to register device', 'Close', { duration: 5000 });
    });
  });

  describe('closeTokenModal', () => {
    it('should clear newDeviceToken', () => {
      component.newDeviceToken.set('some-token');

      component.closeTokenModal();

      expect(component.newDeviceToken()).toBeNull();
    });
  });

  describe('copyToken', () => {
    it('should call clipboard.writeText with the token', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      component.newDeviceToken.set('jwt-token-123');

      component.copyToken();
      await writeText.mock.results[0].value;

      expect(writeText).toHaveBeenCalledWith('jwt-token-123');
      expect(mockSnackBar.open).toHaveBeenCalledWith('Token copied to clipboard', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call clipboard when token is null', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      component.newDeviceToken.set(null);

      component.copyToken();

      expect(writeText).not.toHaveBeenCalled();
    });
  });

  describe('deleteDevice', () => {
    it('should delete and reload when confirmed', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.deleteDevice(mockDevice);
      afterClosed$.next(true);

      expect(mockDeviceService.delete).toHaveBeenCalledWith('d1');
      expect(mockDeviceService.getAll).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Device removed', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should skip deletion when cancelled', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);

      component.deleteDevice(mockDevice);
      afterClosed$.next(false);

      expect(mockDeviceService.delete).not.toHaveBeenCalled();
    });

    it('should show snackbar on delete error', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as MatDialogRef<unknown>);
      const error = { error: { message: 'Cannot remove device' } };
      mockDeviceService.delete.mockReturnValue(throwError(() => error));

      component.deleteDevice(mockDevice);
      afterClosed$.next(true);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Cannot remove device', 'Close', { duration: 5000 });
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
