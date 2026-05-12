import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImportAuditComponent } from './import-audit.component';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { LocaleService } from '@core/i18n/locale.service';
import { ImportAudit } from '@shared/models';
import { TranslocoTestingModule } from '@jsverse/transloco';

const translocoLang = { admin: { importAudit: { status: {} }, common: {}, navigation: {} }, common: { delete: 'Delete' } };

describe('ImportAuditComponent', () => {
  let component: ImportAuditComponent;
  let fixture: ComponentFixture<ImportAuditComponent>;
  let mockService: { getImportAudit: ReturnType<typeof vi.fn> };

  const mockAudit: ImportAudit = {
    id: 'a1',
    sourceUrl: 'https://example.com/feed.zip',
    sourceHash: 'abcdef1234567890',
    startedAt: new Date(2026, 4, 7, 9, 0, 0).toISOString(),
    completedAt: new Date(2026, 4, 7, 9, 1, 30).toISOString(),
    durationMs: 90_000,
    linesCount: 12,
    stopsCount: 1500,
    itinerariesCount: 24,
    schedulesCount: 320_000,
    status: 'SUCCESS',
    errorMessage: null,
    triggeredBy: 'admin',
    validationStatus: 'SUCCESS',
    validationNoticeErrors: 0,
    validationNoticeWarnings: 3,
  };

  beforeEach(() => {
    mockService = {
      getImportAudit: vi.fn().mockReturnValue(of([mockAudit])),
    };

    TestBed.configureTestingModule({
      imports: [
        ImportAuditComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: translocoLang, fr: translocoLang },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: GtfsDataService, useValue: mockService },
        { provide: LocaleService, useValue: { current: signal('fr') } },
      ],
    });

    fixture = TestBed.createComponent(ImportAuditComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads audits on init and clears the loading flag', () => {
    fixture.detectChanges();

    expect(mockService.getImportAudit).toHaveBeenCalledOnce();
    expect(component.audits()).toEqual([mockAudit]);
    expect(component.loading()).toBe(false);
  });

  it('formatDuration handles ms / s / minute boundaries', () => {
    expect(component.formatDuration(450)).toBe('450 ms');
    expect(component.formatDuration(2500)).toBe('2.5 s');
    expect(component.formatDuration(125_000)).toBe('2 min 5 s');
  });

  it('formatLarge compacts above 10k', () => {
    // fr-FR Intl uses U+202F (narrow no-break space) as the thousand
    // separator, not a regular U+0020 — assert the localised output
    // verbatim instead of hard-coding a separator that varies by ICU.
    expect(component.formatLarge(9999)).toBe((9999).toLocaleString('fr-FR'));
    expect(component.formatLarge(12_345)).toBe('12,3k');
  });

  it('statusIcon and statusClass cover every ImportStatus', () => {
    expect(component.statusIcon('SUCCESS')).toBe('check_circle');
    expect(component.statusIcon('SKIPPED_UNCHANGED')).toBe('remove_circle_outline');
    expect(component.statusIcon('FAILED')).toBe('error');
    expect(component.statusIcon('RUNNING')).toBe('sync');
    expect(component.statusClass('FAILED')).toBe('failed');
    expect(component.rowClass({ ...mockAudit, status: 'FAILED' })).toBe('row-failed');
    expect(component.rowClass({ ...mockAudit, status: 'RUNNING' })).toBe('row-running');
    expect(component.rowClass(mockAudit)).toBe('');
  });

  it('error path sets an empty list and clears loading', () => {
    mockService.getImportAudit = vi.fn().mockReturnValue(throwError(() => new Error('fail')));

    fixture.detectChanges();

    expect(component.audits()).toEqual([]);
    expect(component.loading()).toBe(false);
  });
});
