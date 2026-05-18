import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataOverviewCardComponent } from './data-overview-card.component';
import { DataOverviewService } from '@core/api/data-overview.service';
import { LocaleService } from '@core/i18n/locale.service';
import { DataOverview } from '@shared/models';
import { testTranslocoModule } from '../../../../test-translations';

describe('DataOverviewCardComponent', () => {
  let fixture: ComponentFixture<DataOverviewCardComponent>;
  let component: DataOverviewCardComponent;
  let mockService: { getOverview: ReturnType<typeof vi.fn> };

  const fullOverview: DataOverview = {
    staticGtfs: {
      agencies: 1, lines: 12, stops: 1500, disabledStops: 0, itineraries: 24,
      itineraryStops: 4000, schedules: 320_000, serviceCalendars: 5, transfers: 0,
      shapes: 0, pathways: 0, stationLevels: 0, fareAttributes: 0,
      locationGroups: 0, bookingRules: 0, translations: 0, attributions: 0,
    },
    realtime: {
      alerts: 3, tripUpdates: 0, vehiclePositions: 10,
      alertsEnabled: true, tripUpdatesEnabled: false, vehiclePositionsEnabled: true,
    },
  };

  beforeEach(() => {
    mockService = { getOverview: vi.fn().mockReturnValue(of(fullOverview)) };

    TestBed.configureTestingModule({
      imports: [DataOverviewCardComponent, testTranslocoModule({})],
      providers: [
        { provide: DataOverviewService, useValue: mockService },
        { provide: LocaleService, useValue: { current: signal('fr') } },
      ],
    });
    fixture = TestBed.createComponent(DataOverviewCardComponent);
    component = fixture.componentInstance;
  });

  it('loads the overview and flips loaded on success', () => {
    fixture.detectChanges();

    expect(mockService.getOverview).toHaveBeenCalledOnce();
    expect(component.overview()).toEqual(fullOverview);
    expect(component.loaded()).toBe(true);
  });

  it('flips loaded to true on a request failure (no crash)', () => {
    mockService.getOverview = vi.fn().mockReturnValue(throwError(() => new Error('forbidden')));
    fixture = TestBed.createComponent(DataOverviewCardComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();

    expect(component.overview()).toBeNull();
    expect(component.loaded()).toBe(true);
  });

  it('returns true from anyRealtimeConfigured when at least one feed is configured', () => {
    fixture.detectChanges();
    expect(component.anyRealtimeConfigured()).toBe(true);
  });

  it('returns false from anyRealtimeConfigured when no feed is configured', () => {
    const noRt: DataOverview = {
      ...fullOverview,
      realtime: {
        ...fullOverview.realtime,
        alertsEnabled: false,
        tripUpdatesEnabled: false,
        vehiclePositionsEnabled: false,
      },
    };
    mockService.getOverview = vi.fn().mockReturnValue(of(noRt));
    fixture = TestBed.createComponent(DataOverviewCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.anyRealtimeConfigured()).toBe(false);
  });

  it('returns false from anyRealtimeConfigured when the load fails (overview stays null)', () => {
    mockService.getOverview = vi.fn().mockReturnValue(throwError(() => new Error('nope')));
    fixture = TestBed.createComponent(DataOverviewCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.overview()).toBeNull();
    expect(component.anyRealtimeConfigured()).toBe(false);
  });

  it('formatLarge keeps small numbers locale-formatted', () => {
    fixture.detectChanges();
    // fr-FR uses U+202F as thousands separator — assert via toLocaleString to
    // stay decoupled from the actual code point.
    expect(component.formatLarge(9999)).toBe((9999).toLocaleString('fr-FR'));
  });

  it('formatLarge compacts large numbers to a k suffix', () => {
    fixture.detectChanges();
    expect(component.formatLarge(12_345)).toBe('12,3k');
  });
});
