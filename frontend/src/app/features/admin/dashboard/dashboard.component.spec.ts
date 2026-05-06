import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '@core/auth/auth.service';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { ItineraryService } from '@core/api/itinerary.service';
import { MessageService } from '@core/api/message.service';
import { DeviceService } from '@core/api/device.service';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Line, Stop, Itinerary, BroadcastMessage, Device, LineType } from '@shared/models';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockAuthService: { isAdmin: ReturnType<typeof signal<boolean>> };
  let mockLineService: { getAll: ReturnType<typeof vi.fn> };
  let mockStopService: { getAll: ReturnType<typeof vi.fn> };
  let mockItineraryService: { getAll: ReturnType<typeof vi.fn> };
  let mockMessageService: { getAll: ReturnType<typeof vi.fn> };
  let mockDeviceService: { getAll: ReturnType<typeof vi.fn> };

  const mockLines: Line[] = [
    { id: '1', code: 'L1', name: 'Metro Line 1', color: '#FF5733', type: 'METRO', stopCount: 5, itineraryCount: 2 },
    { id: '2', code: 'L2', name: 'Metro Line 2', color: '#33FF57', type: 'METRO', stopCount: 3, itineraryCount: 1 }
  ];

  const mockStops: Stop[] = [
    { id: '1', name: 'Central', latitude: null, longitude: null, lines: [], scheduleCount: 5, hasDevice: true }
  ];

  const mockItineraries: Itinerary[] = [
    { id: '1', name: 'North', terminusName: 'North Station', line: { id: '1', code: 'L1', name: 'Metro 1', color: '#FF5733' }, stops: [] }
  ];

  const now = new Date();
  const futureDate = new Date(now.getTime() + 3600000).toISOString();
  const pastDate = new Date(now.getTime() - 7200000).toISOString();
  const farPast = new Date(now.getTime() - 3600000).toISOString();
  const farFuture = new Date(now.getTime() + 7200000).toISOString();

  const mockActiveMessages: BroadcastMessage[] = [
    {
      id: '1', title: 'Critical Alert', content: 'Service disruption', severity: 'CRITICAL',
      startTime: pastDate, endTime: futureDate, scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: true
    },
    {
      id: '2', title: 'Info Message', content: 'Normal service', severity: 'INFO',
      startTime: pastDate, endTime: futureDate, scopeType: 'LINE', scopeId: '1', scopeInfo: { name: 'L1' }, active: true
    }
  ];

  const mockAllMessages: BroadcastMessage[] = [
    ...mockActiveMessages,
    {
      id: '3', title: 'Scheduled Alert', content: 'Future disruption', severity: 'WARNING',
      startTime: farFuture, endTime: new Date(now.getTime() + 86400000).toISOString(),
      scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: false
    }
  ];

  const mockDevices: Device[] = [
    { id: '1', stopId: 's1', stopName: 'Central', lines: [], status: 'ONLINE' },
    { id: '2', stopId: 's2', stopName: 'North', lines: [], status: 'OFFLINE' }
  ];

  beforeEach(() => {
    mockAuthService = { isAdmin: signal(true) };
    mockLineService = { getAll: vi.fn().mockReturnValue(of(mockLines)) };
    mockStopService = { getAll: vi.fn().mockReturnValue(of(mockStops)) };
    mockItineraryService = { getAll: vi.fn().mockReturnValue(of(mockItineraries)) };
    mockMessageService = { getAll: vi.fn().mockReturnValue(of(mockAllMessages)) };
    mockDeviceService = { getAll: vi.fn().mockReturnValue(of(mockDevices)) };

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: LineService, useValue: mockLineService },
        { provide: StopService, useValue: mockStopService },
        { provide: ItineraryService, useValue: mockItineraryService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: DeviceService, useValue: mockDeviceService }
      ]
    });

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadData', () => {
    it('should load all data via forkJoin on init', () => {
      fixture.detectChanges(); // triggers ngOnInit

      expect(mockLineService.getAll).toHaveBeenCalled();
      expect(mockStopService.getAll).toHaveBeenCalled();
      expect(mockItineraryService.getAll).toHaveBeenCalled();
      expect(mockMessageService.getAll).toHaveBeenCalled();
      expect(mockDeviceService.getAll).toHaveBeenCalled();
    });

    it('should set loading to false after data loads', () => {
      expect(component.loading()).toBe(true);

      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });

    it('should populate signals with data', () => {
      fixture.detectChanges();

      expect(component.lines()).toEqual(mockLines);
      expect(component.stops()).toEqual(mockStops);
      expect(component.itineraries()).toEqual(mockItineraries);
      expect(component.activeMessages()).toEqual(mockActiveMessages);
      expect(component.devices()).toEqual(mockDevices);
    });

    it('should set loading to false on error', () => {
      mockLineService.getAll = vi.fn().mockReturnValue(throwError(() => new Error('fail')));

      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });
  });

  describe('computed signals', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should compute criticalMessages', () => {
      expect(component.criticalMessages().length).toBe(1);
      expect(component.criticalMessages()[0]!.title).toBe('Critical Alert');
    });

    it('should compute offlineDevices', () => {
      expect(component.offlineDevices().length).toBe(1);
      expect(component.offlineDevices()[0]!.stopName).toBe('North');
    });

    it('should compute onlineDevices count', () => {
      expect(component.onlineDevices()).toBe(1);
    });

    it('should compute deviceHealthPercent', () => {
      expect(component.deviceHealthPercent()).toBe(50);
    });

    it('should return 100% health when no devices', () => {
      component.devices.set([]);
      expect(component.deviceHealthPercent()).toBe(100);
    });

    it('should compute deviceHealthPercent as 75 when 3 of 4 devices are online', () => {
      component.devices.set([
        { id: '1', stopId: 's1', stopName: 'A', lines: [], status: 'ONLINE' },
        { id: '2', stopId: 's2', stopName: 'B', lines: [], status: 'ONLINE' },
        { id: '3', stopId: 's3', stopName: 'C', lines: [], status: 'ONLINE' },
        { id: '4', stopId: 's4', stopName: 'D', lines: [], status: 'OFFLINE' },
      ]);
      expect(component.deviceHealthPercent()).toBe(75);
    });

    it('should limit displayedOfflineDevices to 6', () => {
      component.devices.set([
        { id: '1', stopId: 's1', stopName: 'A', lines: [], status: 'OFFLINE' },
        { id: '2', stopId: 's2', stopName: 'B', lines: [], status: 'OFFLINE' },
        { id: '3', stopId: 's3', stopName: 'C', lines: [], status: 'OFFLINE' },
        { id: '4', stopId: 's4', stopName: 'D', lines: [], status: 'OFFLINE' },
        { id: '5', stopId: 's5', stopName: 'E', lines: [], status: 'OFFLINE' },
        { id: '6', stopId: 's6', stopName: 'F', lines: [], status: 'OFFLINE' },
        { id: '7', stopId: 's7', stopName: 'G', lines: [], status: 'OFFLINE' },
        { id: '8', stopId: 's8', stopName: 'H', lines: [], status: 'OFFLINE' },
      ]);

      expect(component.offlineDevices().length).toBe(8);
      expect(component.displayedOfflineDevices().length).toBe(6);
      expect(component.remainingOfflineCount()).toBe(2);
    });

    it('should limit displayedCriticalMessages to 6', () => {
      component.activeMessages.set([
        { id: '1', title: 'C1', content: '', severity: 'CRITICAL', startTime: pastDate, endTime: futureDate, scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: true },
        { id: '2', title: 'C2', content: '', severity: 'CRITICAL', startTime: pastDate, endTime: futureDate, scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: true },
        { id: '3', title: 'C3', content: '', severity: 'CRITICAL', startTime: pastDate, endTime: futureDate, scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: true },
        { id: '4', title: 'C4', content: '', severity: 'CRITICAL', startTime: pastDate, endTime: futureDate, scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: true },
        { id: '5', title: 'C5', content: '', severity: 'CRITICAL', startTime: pastDate, endTime: futureDate, scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: true },
        { id: '6', title: 'C6', content: '', severity: 'CRITICAL', startTime: pastDate, endTime: futureDate, scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: true },
        { id: '7', title: 'C7', content: '', severity: 'CRITICAL', startTime: pastDate, endTime: futureDate, scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: true },
      ]);

      expect(component.criticalMessages().length).toBe(7);
      expect(component.displayedCriticalMessages().length).toBe(6);
      expect(component.remainingCriticalCount()).toBe(1);
    });

    it('should compute recentMessages sorted by startTime descending', () => {
      const recent = component.recentMessages();
      expect(recent.length).toBe(3);
      // Most recent startTime should be first
      for (let i = 0; i < recent.length - 1; i++) {
        expect(new Date(recent[i]!.startTime).getTime()).toBeGreaterThanOrEqual(
          new Date(recent[i + 1]!.startTime).getTime()
        );
      }
    });

    it('should show hasMoreLines when more than 6 lines exist', () => {
      component.lines.set(
        Array.from({ length: 8 }, (_, i) => ({
          id: String(i),
          code: `L${i}`,
          name: `Line ${i}`,
          color: '#000',
          type: null as unknown as LineType,
          stopCount: 0,
          itineraryCount: 0,
        }))
      );

      expect(component.hasMoreLines()).toBe(true);
      expect(component.displayedLines().length).toBe(6);
    });

    it('should not show hasMoreLines when 6 or fewer lines exist', () => {
      expect(component.lines().length).toBe(2);
      expect(component.hasMoreLines()).toBe(false);
      expect(component.displayedLines().length).toBe(2);
    });
  });

  describe('empty data handling', () => {
    it('should handle no lines, no devices, no messages gracefully', () => {
      mockLineService.getAll = vi.fn().mockReturnValue(of([]));
      mockStopService.getAll = vi.fn().mockReturnValue(of([]));
      mockItineraryService.getAll = vi.fn().mockReturnValue(of([]));
      mockMessageService.getAll = vi.fn().mockReturnValue(of([]));
      mockDeviceService.getAll = vi.fn().mockReturnValue(of([]));

      fixture.detectChanges();

      expect(component.lines().length).toBe(0);
      expect(component.stops().length).toBe(0);
      expect(component.itineraries().length).toBe(0);
      expect(component.devices().length).toBe(0);
      expect(component.activeMessages().length).toBe(0);
      expect(component.criticalMessages().length).toBe(0);
      expect(component.offlineDevices().length).toBe(0);
      expect(component.onlineDevices()).toBe(0);
      expect(component.deviceHealthPercent()).toBe(100);
      expect(component.recentMessages().length).toBe(0);
      expect(component.loading()).toBe(false);
    });
  });

  describe('getMessageStatus', () => {
    it('should return active for current messages', () => {
      const message: BroadcastMessage = {
        id: '1', title: 'Test', content: '', severity: 'INFO',
        startTime: pastDate, endTime: futureDate,
        scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: true
      };

      expect(component.getMessageStatus(message)).toBe('active');
    });

    it('should return scheduled for future messages', () => {
      const message: BroadcastMessage = {
        id: '1', title: 'Test', content: '', severity: 'INFO',
        startTime: farFuture, endTime: new Date(now.getTime() + 86400000).toISOString(),
        scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: false
      };

      expect(component.getMessageStatus(message)).toBe('scheduled');
    });

    it('should return expired for past messages', () => {
      const message: BroadcastMessage = {
        id: '1', title: 'Test', content: '', severity: 'INFO',
        startTime: new Date(now.getTime() - 86400000).toISOString(),
        endTime: farPast,
        scopeType: 'NETWORK', scopeId: null, scopeInfo: null, active: false
      };

      expect(component.getMessageStatus(message)).toBe('expired');
    });
  });

  describe('AGENT role', () => {
    beforeEach(() => {
      mockAuthService.isAdmin.set(false);
    });

    it('should only call messageService.getAll for AGENT', () => {
      fixture.detectChanges();

      expect(mockMessageService.getAll).toHaveBeenCalled();
      expect(mockLineService.getAll).not.toHaveBeenCalled();
      expect(mockStopService.getAll).not.toHaveBeenCalled();
      expect(mockItineraryService.getAll).not.toHaveBeenCalled();
      expect(mockDeviceService.getAll).not.toHaveBeenCalled();
    });

    it('should set loading to false after AGENT data loads', () => {
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(component.activeMessages()).toEqual(mockActiveMessages);
      expect(component.allMessages()).toEqual(mockAllMessages);
    });

    it('should not display admin-only stat cards for AGENT', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const statLabels = fixture.nativeElement.querySelectorAll('.stat-label');
      const labelTexts = Array.from(statLabels as NodeListOf<HTMLElement>).map((el) => el.textContent.trim());

      expect(labelTexts).toContain('Active Messages');
      expect(labelTexts).not.toContain('Lines');
      expect(labelTexts).not.toContain('Stops');
      expect(labelTexts).not.toContain('Itineraries');
      expect(labelTexts).not.toContain('Devices Online');
    });

    it('should not display admin-only quick actions for AGENT', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const actionButtons = fixture.nativeElement.querySelectorAll('.action-btn span');
      const actionTexts = Array.from(actionButtons as NodeListOf<HTMLElement>).map((el) => el.textContent.trim());

      expect(actionTexts).toContain('New Message');
      expect(actionTexts).toContain('Network Map');
      expect(actionTexts).not.toContain('Manage Lines');
      expect(actionTexts).not.toContain('Manage Stops');
      expect(actionTexts).not.toContain('Edit Schedules');
      expect(actionTexts).not.toContain('Register Device');
      expect(actionTexts).not.toContain('Manage Users');
    });

    it('should not display the overview grid for AGENT', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const overviewGrid = fixture.nativeElement.querySelector('.overview-grid');
      expect(overviewGrid).toBeFalsy();
    });

    it('should set loading to false on error for AGENT', () => {
      mockMessageService.getAll = vi.fn().mockReturnValue(throwError(() => new Error('fail')));

      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });
  });
});
