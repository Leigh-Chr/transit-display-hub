import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GtfsDataComponent } from './gtfs-data.component';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { NotifyService } from '@core/services/notify.service';
import { BookingRule, FareAttribute, FaresV2, Translation } from '@shared/models';
import { testTranslocoModule } from '../../../../test-translations';

const gtfsDataDict = {
  admin: {
    gtfsData: {
      payment: { onBoard: 'À bord', advance: 'À l\'avance' },
      transfer: { unlimited: 'Illimitées', none: 'Aucune', duration: '{{ minutes }} min' },
      rule: { unconditional: 'Tarif unitaire sans condition', fallback: 'tarif applicable' },
      bookingType: { REAL_TIME: 'Temps réel', SAME_DAY: 'Jour même', PRIOR_DAYS: 'À l\'avance' },
      transferType: {
        '0': 'A + transfer combinés', '1': 'A puis transfer séparé',
        '2': 'Transfer remplace A', unknown: 'Type {{ type }}',
      },
      mediaType: {
        '0': 'Aucun', '1': 'Papier', '2': 'Carte transport',
        '3': 'Sans contact (EMV)', '4': 'Mobile', unknown: 'Type {{ type }}',
      },
      notice: {
        range: '{{ min }}–{{ max }} min', minOnly: '≥ {{ min }} min',
        lastDay: 'J−{{ day }}', lastDayWithTime: 'J−{{ day }} à {{ time }}',
      },
    },
  },
};

describe('GtfsDataComponent', () => {
  let component: GtfsDataComponent;
  let fixture: ComponentFixture<GtfsDataComponent>;
  let mockService: {
    getFares: ReturnType<typeof vi.fn>;
    getBookingRules: ReturnType<typeof vi.fn>;
    getTranslations: ReturnType<typeof vi.fn>;
    getFaresV2: ReturnType<typeof vi.fn>;
  };

  const mockFare: FareAttribute = {
    id: 'f1',
    externalId: 'std',
    price: '2.00',
    currency: 'EUR',
    paymentMethod: 'BEFORE_BOARDING',
    transfers: 1,
    transferDuration: 3600,
    agencyId: null,
    agencyName: null,
    rules: [],
  };

  const mockBooking: BookingRule = {
    id: 'b1',
    externalId: 'tad-1',
    bookingType: 'PRIOR_DAYS',
    priorNoticeDurationMin: 60,
    priorNoticeDurationMax: null,
    priorNoticeLastDay: 1,
    priorNoticeLastTime: '17:00:00',
    priorNoticeStartDay: 14,
    phone: '0800123456',
    bookingUrl: null,
    infoUrl: null,
    message: 'Reserve la veille',
  };

  const mockTrans: Translation = {
    id: 't1',
    tableName: 'stops',
    recordId: 's1',
    fieldValue: 'Place de la Bourse',
    fieldName: 'stop_name',
    language: 'en',
    translation: 'Stock Exchange Square',
  };

  const mockFv2: FaresV2 = {
    areas: [],
    timeframes: [],
    products: [],
    legRules: [],
    transferRules: [],
    networks: [],
    fareMedia: [],
    legJoinRules: [],
  };

  beforeEach(() => {
    mockService = {
      getFares: vi.fn().mockReturnValue(of([mockFare])),
      getBookingRules: vi.fn().mockReturnValue(of([mockBooking])),
      getTranslations: vi.fn().mockReturnValue(of([mockTrans])),
      getFaresV2: vi.fn().mockReturnValue(of(mockFv2)),
    };

    TestBed.configureTestingModule({
      imports: [
        GtfsDataComponent,
        testTranslocoModule(gtfsDataDict),
      ],
      providers: [
        provideRouter([]),
        { provide: GtfsDataService, useValue: mockService },
        { provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(GtfsDataComponent);
    component = fixture.componentInstance;
  });

  it('loads fares, booking rules, translations and fares v2 on init', () => {
    fixture.detectChanges();

    expect(mockService.getFares).toHaveBeenCalledOnce();
    expect(mockService.getBookingRules).toHaveBeenCalledOnce();
    expect(mockService.getTranslations).toHaveBeenCalledOnce();
    expect(mockService.getFaresV2).toHaveBeenCalledOnce();

    expect(component.fares().length).toBe(1);
    expect(component.bookingRules().length).toBe(1);
    expect(component.translations().length).toBe(1);
    expect(component.faresV2()).toEqual(mockFv2);
  });

  it('translation reload uses the selected language and table filter', () => {
    fixture.detectChanges();
    component.language = 'de';
    component.tableFilter = 'stops';

    component.loadTranslations();

    expect(mockService.getTranslations).toHaveBeenLastCalledWith('de', 'stops');
  });

  it('translation reload omits the table filter when empty', () => {
    fixture.detectChanges();
    component.language = 'en';
    component.tableFilter = '';

    component.loadTranslations();

    expect(mockService.getTranslations).toHaveBeenLastCalledWith('en', undefined);
  });

  it('paymentLabel maps Fares v1 enum values', () => {
    expect(component.paymentLabel('ON_BOARD')).toBe('À bord');
    expect(component.paymentLabel('BEFORE_BOARDING')).toBe('À l\'avance');
    expect(component.paymentLabel(null)).toBe('—');
  });

  it('transferLabel covers unlimited / none / counted with duration', () => {
    expect(component.transferLabel({ ...mockFare, transfers: null })).toBe('Illimitées');
    expect(component.transferLabel({ ...mockFare, transfers: 0 })).toBe('Aucune');
    expect(component.transferLabel({ ...mockFare, transfers: 2, transferDuration: 1800 })).toBe('2 (30 min)');
  });

  it('bookingTypeLabel maps the three GTFS values', () => {
    expect(component.bookingTypeLabel('REAL_TIME')).toBe('Temps réel');
    expect(component.bookingTypeLabel('SAME_DAY')).toBe('Jour même');
    expect(component.bookingTypeLabel('PRIOR_DAYS')).toBe('À l\'avance');
  });

  it('mediaTypeLabel covers every GTFS code', () => {
    expect(component.mediaTypeLabel(0)).toBe('Aucun');
    expect(component.mediaTypeLabel(1)).toBe('Papier');
    expect(component.mediaTypeLabel(2)).toBe('Carte transport');
    expect(component.mediaTypeLabel(3)).toBe('Sans contact (EMV)');
    expect(component.mediaTypeLabel(4)).toBe('Mobile');
    expect(component.mediaTypeLabel(null)).toBe('—');
  });

  it('transferTypeLabel covers GTFS Fares v2 values', () => {
    expect(component.transferTypeLabel(0)).toBe('A + transfer combinés');
    expect(component.transferTypeLabel(1)).toBe('A puis transfer séparé');
    expect(component.transferTypeLabel(2)).toBe('Transfer remplace A');
    expect(component.transferTypeLabel(99)).toBe('Type 99');
  });
});
