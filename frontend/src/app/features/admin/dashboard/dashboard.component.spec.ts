import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '@core/auth/auth.service';
import { LineService } from '@core/api/line.service';
import { MessageService } from '@core/api/message.service';
import { DashboardService, DashboardSummary } from '@core/api/dashboard.service';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Line, BroadcastMessage, Device } from '@shared/models';
import { TranslocoTestingModule } from '@jsverse/transloco';

const translocoLang = {
  admin: {
    dashboard: {
      feedInfo: {},
      messageStatus: { active: 'Active', scheduled: 'Scheduled', expired: 'Expired' },
      statActiveMessages: 'Active Messages',
      statLines: 'Lines',
      statStops: 'Stops',
      statItineraries: 'Itineraries',
      statDevicesOnline: 'Devices Online',
      actionNewMessage: 'New Message',
      actionNetworkMap: 'Network Map',
      actionManageLines: 'Manage Lines',
      actionManageStops: 'Manage Stops',
      actionEditSchedules: 'Edit Schedules',
      actionRegisterDevice: 'Register Device',
      actionManageUsers: 'Manage Users',
      actionHubDisplay: 'Hub Display',
    },
    common: {},
    navigation: {},
  },
  common: { delete: 'Delete' },
};

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockAuthService: { isAdmin: ReturnType<typeof signal<boolean>> };
  let mockLineService: { getAll: ReturnType<typeof vi.fn> };
  let mockMessageService: { getAll: ReturnType<typeof vi.fn> };
  let mockDashboardService: { getSummary: ReturnType<typeof vi.fn> };

  const mockLines: Line[] = [
    { id: '1', code: 'L1', name: 'Metro Line 1', color: '#FF5733', type: 'METRO', stopCount: 5, itineraryCount: 2 },
    { id: '2', code: 'L2', name: 'Metro Line 2', color: '#33FF57', type: 'METRO', stopCount: 3, itineraryCount: 1 }
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

  const mockOfflineDevicePreview: Device[] = [
    { id: '2', stopId: 's2', stopName: 'North', lines: [], status: 'OFFLINE' }
  ];

  const mockSummary: DashboardSummary = {
    lineCount: 2,
    stopCount: 1,
    itineraryCount: 1,
    topLines: mockLines,
    activeMessages: mockActiveMessages,
    recentMessages: mockAllMessages,
    devices: {
      total: 2,
      online: 1,
      offline: 1,
      offlinePreview: mockOfflineDevicePreview
    }
  };

  beforeEach(() => {
    mockAuthService = { isAdmin: signal(true) };
    mockLineService = { getAll: vi.fn().mockReturnValue(of(mockLines)) };
    mockMessageService = { getAll: vi.fn().mockReturnValue(of(mockAllMessages)) };
    mockDashboardService = { getSummary: vi.fn().mockReturnValue(of(mockSummary)) };

    TestBed.configureTestingModule({
      imports: [
        DashboardComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: translocoLang, fr: translocoLang },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: LineService, useValue: mockLineService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: DashboardService, useValue: mockDashboardService }
      ]
    });

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadData (admin)', () => {
    it('should call the aggregated dashboard endpoint exactly once', () => {
      fixture.detectChanges();

      expect(mockDashboardService.getSummary).toHaveBeenCalledTimes(1);
      expect(mockLineService.getAll).not.toHaveBeenCalled();
      expect(mockMessageService.getAll).not.toHaveBeenCalled();
    });

    it('should set loading to false after data loads', () => {
      expect(component.loading()).toBe(true);

      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });

    it('should populate counters and previews from the summary', () => {
      fixture.detectChanges();

      expect(component.lineCount()).toBe(2);
      expect(component.stopCount()).toBe(1);
      expect(component.itineraryCount()).toBe(1);
      expect(component.activeMessages()).toEqual(mockActiveMessages);
      expect(component.totalDevicesCount()).toBe(2);
      expect(component.onlineDevicesCount()).toBe(1);
      expect(component.offlineDevices()).toEqual(mockOfflineDevicePreview);
    });

    it('should set loading to false on error', () => {
      mockDashboardService.getSummary = vi.fn().mockReturnValue(throwError(() => new Error('fail')));

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

    it('should expose offlineDevices preview from the summary', () => {
      expect(component.offlineDevices().length).toBe(1);
      expect(component.offlineDevices()[0]!.stopName).toBe('North');
    });

    it('should compute deviceHealthPercent', () => {
      expect(component.deviceHealthPercent()).toBe(50);
    });

    it('should return 100% health when no devices', () => {
      component.totalDevicesCount.set(0);
      component.onlineDevicesCount.set(0);
      expect(component.deviceHealthPercent()).toBe(100);
    });

    it('should compute deviceHealthPercent as 75 when 3 of 4 devices are online', () => {
      component.totalDevicesCount.set(4);
      component.onlineDevicesCount.set(3);
      expect(component.deviceHealthPercent()).toBe(75);
    });

    it('should compute remainingOfflineCount from the summary delta', () => {
      // 1 in preview, 1 total offline → 0 remaining
      expect(component.remainingOfflineCount()).toBe(0);
    });

    it('should limit displayedCriticalMessages to 6', () => {
      const many: BroadcastMessage[] = Array.from({ length: 7 }, (_, i) => ({
        id: String(i),
        title: `C${i}`,
        content: '',
        severity: 'CRITICAL',
        startTime: pastDate,
        endTime: futureDate,
        scopeType: 'NETWORK',
        scopeId: null,
        scopeInfo: null,
        active: true,
      }));
      component.activeMessages.set(many);

      expect(component.criticalMessages().length).toBe(7);
      expect(component.displayedCriticalMessages().length).toBe(6);
      expect(component.remainingCriticalCount()).toBe(1);
    });

    it('should compute recentMessages sorted by startTime descending', () => {
      const recent = component.recentMessages();
      expect(recent.length).toBeGreaterThan(0);
      for (let i = 0; i < recent.length - 1; i++) {
        expect(new Date(recent[i]!.startTime).getTime()).toBeGreaterThanOrEqual(
          new Date(recent[i + 1]!.startTime).getTime()
        );
      }
    });

    it('should expose hasMoreLines from the summary delta', () => {
      // summary lineCount=2, topLines length=2 → no more
      expect(component.hasMoreLines()).toBe(false);
      expect(component.displayedLines().length).toBe(2);
    });

    it('should report hasMoreLines when summary count exceeds topLines', () => {
      component.lineCount.set(20);
      component.hasMoreLinesValue.set(true);
      expect(component.hasMoreLines()).toBe(true);
    });
  });

  describe('empty data handling', () => {
    it('should handle empty summary gracefully', () => {
      mockDashboardService.getSummary = vi.fn().mockReturnValue(of({
        lineCount: 0,
        stopCount: 0,
        itineraryCount: 0,
        topLines: [],
        activeMessages: [],
        recentMessages: [],
        devices: { total: 0, online: 0, offline: 0, offlinePreview: [] },
      } satisfies DashboardSummary));

      fixture.detectChanges();

      expect(component.lineCount()).toBe(0);
      expect(component.stopCount()).toBe(0);
      expect(component.itineraryCount()).toBe(0);
      expect(component.totalDevicesCount()).toBe(0);
      expect(component.activeMessages().length).toBe(0);
      expect(component.criticalMessages().length).toBe(0);
      expect(component.offlineDevices().length).toBe(0);
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
      expect(mockDashboardService.getSummary).not.toHaveBeenCalled();
      expect(mockLineService.getAll).not.toHaveBeenCalled();
    });

    it('should set loading to false after AGENT data loads', () => {
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(component.activeMessages()).toEqual(mockActiveMessages);
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
