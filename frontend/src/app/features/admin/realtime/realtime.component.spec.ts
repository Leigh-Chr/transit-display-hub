import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotifyService } from '@core/services/notify.service';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealtimeComponent } from './realtime.component';
import { RealtimeService } from '@core/api/realtime.service';
import { RealtimeAlert, VehiclePosition } from '@shared/models';

describe('RealtimeComponent', () => {
  let component: RealtimeComponent;
  let fixture: ComponentFixture<RealtimeComponent>;
  let mockService: {
    getAlerts: ReturnType<typeof vi.fn>;
    refreshAlerts: ReturnType<typeof vi.fn>;
    getVehicles: ReturnType<typeof vi.fn>;
    refreshVehicles: ReturnType<typeof vi.fn>;
  };
  let mockNotify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  const mockAlert: RealtimeAlert = {
    id: 'a1',
    routeIds: ['L1'],
    stopIds: [],
    agencyIds: [],
    headerText: 'Travaux',
    descriptionText: 'Suppression de service',
    url: null,
    cause: 'CONSTRUCTION',
    effect: 'NO_SERVICE',
    severity: 'CRITICAL',
  };

  const mockVehicle: VehiclePosition = {
    entityId: 'v1',
    vehicleId: 'V-12',
    vehicleLabel: 'Bus 12',
    tripId: 't1',
    routeId: 'L1',
    latitude: 44.83,
    longitude: -0.57,
    bearing: 90,
    speedMetresPerSecond: 8,
    currentStatus: 'IN_TRANSIT_TO',
    currentStopId: 's1',
    currentStopSequence: 5,
    congestionLevel: null,
    occupancyStatus: 'FEW_SEATS_AVAILABLE',
    occupancyPercentage: null,
    timestampEpochSeconds: 1_700_000_000,
  };

  beforeEach(() => {
    mockService = {
      getAlerts: vi.fn().mockReturnValue(of([mockAlert])),
      refreshAlerts: vi.fn().mockReturnValue(of([mockAlert])),
      getVehicles: vi.fn().mockReturnValue(of([mockVehicle])),
      refreshVehicles: vi.fn().mockReturnValue(of([mockVehicle])),
    };
    mockNotify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      imports: [RealtimeComponent],
      providers: [
        provideRouter([]),
        { provide: RealtimeService, useValue: mockService },
        { provide: NotifyService, useValue: mockNotify },
      ],
    });

    fixture = TestBed.createComponent(RealtimeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads both feeds on init', () => {
    fixture.detectChanges();

    expect(mockService.getAlerts).toHaveBeenCalledOnce();
    expect(mockService.getVehicles).toHaveBeenCalledOnce();
    expect(component.alerts().length).toBe(1);
    expect(component.vehicles().length).toBe(1);
  });

  it('refreshAlerts repolls and updates the timestamp', () => {
    fixture.detectChanges();
    const before = component.alertsLoadedAt();

    component.refreshAlerts();

    expect(mockService.refreshAlerts).toHaveBeenCalledOnce();
    expect(component.alertsLoadedAt()).not.toEqual(before);
    expect(component.refreshingAlerts()).toBe(false);
  });

  it('refreshAlerts surfaces an info notification when the feed is not configured', () => {
    mockService.refreshAlerts = vi.fn().mockReturnValue(throwError(() => new Error('400')));
    fixture.detectChanges();

    component.refreshAlerts();

    expect(mockNotify.info).toHaveBeenCalled();
    expect(component.refreshingAlerts()).toBe(false);
  });

  it('kmh converts m/s to km/h', () => {
    expect(component.kmh(10)).toBeCloseTo(36);
  });

  it('occupancyLabel formats status with percentage when both are present', () => {
    expect(component.occupancyLabel({ ...mockVehicle, occupancyStatus: 'CRUSHED', occupancyPercentage: 95 }))
      .toBe('CRUSHED (95%)');
    expect(component.occupancyLabel({ ...mockVehicle, occupancyStatus: null, occupancyPercentage: 50 }))
      .toBe('50%');
    expect(component.occupancyLabel({ ...mockVehicle, occupancyStatus: null, occupancyPercentage: null }))
      .toBe('—');
  });

  it('swallows the alerts error path silently (empty state covers it)', () => {
    mockService.getAlerts = vi.fn().mockReturnValue(throwError(() => new Error('fail')));

    fixture.detectChanges();

    expect(component.alerts()).toEqual([]);
  });
});
