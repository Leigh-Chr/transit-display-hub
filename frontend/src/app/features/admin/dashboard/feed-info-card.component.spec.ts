import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FeedInfoCardComponent } from './feed-info-card.component';
import { FeedInfoService } from '@core/api/feed-info.service';
import { FeedInfo } from '@shared/models';
import { testTranslocoModule } from '../../../../test-translations';

describe('FeedInfoCardComponent', () => {
  let fixture: ComponentFixture<FeedInfoCardComponent>;
  let component: FeedInfoCardComponent;
  let mockService: { getFeedInfo: ReturnType<typeof vi.fn> };

  const baseFeed: FeedInfo = {
    publisherName: 'M Réso Grenoble',
    publisherUrl: null,
    lang: 'fr',
    defaultLang: 'fr',
    feedVersion: 'v3',
    contactEmail: null,
    contactUrl: null,
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    sourceUrl: null,
    sourceHash: null,
    importedAt: null,
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 18)));

    mockService = { getFeedInfo: vi.fn().mockReturnValue(of(baseFeed)) };

    TestBed.configureTestingModule({
      imports: [FeedInfoCardComponent, testTranslocoModule({})],
      providers: [
        { provide: FeedInfoService, useValue: mockService },
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(FeedInfoCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the feed and flips loaded to true on success', () => {
    fixture.detectChanges();

    expect(mockService.getFeedInfo).toHaveBeenCalledOnce();
    expect(component.feed()).toEqual(baseFeed);
    expect(component.loaded()).toBe(true);
  });

  it('still flips loaded to true on a request failure', () => {
    mockService.getFeedInfo = vi.fn().mockReturnValue(throwError(() => new Error('forbidden')));
    fixture = TestBed.createComponent(FeedInfoCardComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();

    expect(component.feed()).toBeNull();
    expect(component.loaded()).toBe(true);
  });

  it('returns "current" status when endDate is more than a week away', () => {
    fixture.detectChanges();
    expect(component.status()).toBe('current');
    expect(component.daysRemaining()).toBe(228);
  });

  it('returns "expiring" status when endDate is within a week', () => {
    mockService.getFeedInfo = vi.fn().mockReturnValue(of({ ...baseFeed, endDate: '2026-05-22' }));
    fixture = TestBed.createComponent(FeedInfoCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.status()).toBe('expiring');
  });

  it('returns "expired" status when endDate is in the past', () => {
    mockService.getFeedInfo = vi.fn().mockReturnValue(of({ ...baseFeed, endDate: '2026-04-01' }));
    fixture = TestBed.createComponent(FeedInfoCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.status()).toBe('expired');
  });

  it('returns "none" status when no feed is loaded', () => {
    mockService.getFeedInfo = vi.fn().mockReturnValue(throwError(() => new Error('nope')));
    fixture = TestBed.createComponent(FeedInfoCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.status()).toBe('none');
  });

  it('returns null daysRemaining when endDate is missing', () => {
    mockService.getFeedInfo = vi.fn().mockReturnValue(of({ ...baseFeed, endDate: null }));
    fixture = TestBed.createComponent(FeedInfoCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.daysRemaining()).toBeNull();
    expect(component.status()).toBe('current');
  });

  it('returns null daysRemaining when endDate is unparseable', () => {
    // We avoid running detectChanges here: the template would feed the
    // invalid string into the {| date} pipe and throw. The signal
    // re-evaluates synchronously the moment we read it, which is all
    // this test cares about.
    mockService.getFeedInfo = vi.fn().mockReturnValue(of({ ...baseFeed, endDate: 'not-a-date' }));
    fixture = TestBed.createComponent(FeedInfoCardComponent);
    component = fixture.componentInstance;
    // Constructor's subscribe resolves synchronously with the mock.

    expect(component.daysRemaining()).toBeNull();
  });

  it('statusIcon maps to verified / schedule / error_outline', () => {
    mockService.getFeedInfo = vi.fn().mockReturnValue(of({ ...baseFeed, endDate: '2027-01-01' }));
    fixture = TestBed.createComponent(FeedInfoCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.statusIcon()).toBe('verified');

    mockService.getFeedInfo = vi.fn().mockReturnValue(of({ ...baseFeed, endDate: '2026-05-20' }));
    fixture = TestBed.createComponent(FeedInfoCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.statusIcon()).toBe('schedule');

    mockService.getFeedInfo = vi.fn().mockReturnValue(of({ ...baseFeed, endDate: '2026-01-01' }));
    fixture = TestBed.createComponent(FeedInfoCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.statusIcon()).toBe('error_outline');
  });

  it('statusTooltip routes to the matching i18n key per status', () => {
    const t = (key: string): string => key;
    fixture.detectChanges();
    expect(component.statusTooltip(t)).toBe('admin.dashboard.feedInfo.statusCurrent');
  });
});
