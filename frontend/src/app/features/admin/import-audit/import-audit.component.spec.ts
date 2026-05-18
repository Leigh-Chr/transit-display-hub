import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NEVER, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImportAuditComponent } from './import-audit.component';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { LocaleService } from '@core/i18n/locale.service';
import { NotifyService } from '@core/services/notify.service';
import { ImportAudit } from '@shared/models';
import { testTranslocoModule } from '../../../../test-translations';

/** Match the helper's flush — rxResource settles a value across two
 *  microtask boundaries plus a TestBed tick. */
async function flushResource(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  TestBed.tick();
}

const translocoLang = { admin: { importAudit: { status: {} }, common: {}, navigation: {} }, common: { delete: 'Delete' } };
const translocoLangFr = { admin: { importAudit: { status: {} }, common: {}, navigation: {} }, common: { delete: 'Supprimer' } };

describe('ImportAuditComponent', () => {
  let component: ImportAuditComponent;
  let fixture: ComponentFixture<ImportAuditComponent>;
  let mockService: {
    getImportAudit: ReturnType<typeof vi.fn>;
    triggerReimport: ReturnType<typeof vi.fn>;
  };
  let mockNotify: {
    success: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

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
      triggerReimport: vi.fn().mockReturnValue(of(undefined)),
    };
    mockNotify = {
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [
        ImportAuditComponent,
        testTranslocoModule(translocoLang, translocoLangFr),
      ],
      providers: [
        provideRouter([]),
        { provide: GtfsDataService, useValue: mockService },
        { provide: LocaleService, useValue: { current: signal('fr') } },
        { provide: NotifyService, useValue: mockNotify },
      ],
    });

    fixture = TestBed.createComponent(ImportAuditComponent);
    component = fixture.componentInstance;
  });

  it('loads audits on init and clears the loading flag', async () => {
    fixture.detectChanges();
    await flushResource();

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

  it('error path sets an empty list and clears loading', async () => {
    mockService.getImportAudit = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    // Re-create the component so the resource's first fetch already
    // uses the failing mock.
    fixture = TestBed.createComponent(ImportAuditComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
    await flushResource();

    expect(component.audits()).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  describe('triggerReimport', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('calls the service, notifies success and clears the triggering flag', () => {
      component.triggerReimport();
      expect(mockService.triggerReimport).toHaveBeenCalledOnce();
      expect(mockNotify.success).toHaveBeenCalledOnce();
      expect(component.triggering()).toBe(false);
    });

    it('ignores re-entry while a trigger is in flight', () => {
      // NEVER holds the observable open so the triggering signal stays
      // true and the second call hits the early return.
      mockService.triggerReimport = vi.fn().mockReturnValue(NEVER);
      fixture = TestBed.createComponent(ImportAuditComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.triggerReimport();
      component.triggerReimport();
      expect(mockService.triggerReimport).toHaveBeenCalledOnce();
    });

    it('maps 409 to a warn notification', () => {
      mockService.triggerReimport = vi.fn().mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'busy' } })),
      );
      fixture = TestBed.createComponent(ImportAuditComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.triggerReimport();
      expect(mockNotify.warn).toHaveBeenCalledWith('busy');
      expect(component.triggering()).toBe(false);
    });

    it('maps 400 to the no-feed error', () => {
      mockService.triggerReimport = vi.fn().mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 400 })),
      );
      fixture = TestBed.createComponent(ImportAuditComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.triggerReimport();
      expect(mockNotify.error).toHaveBeenCalledOnce();
      expect(component.triggering()).toBe(false);
    });

    it('falls back to a generic error on 5xx', () => {
      mockService.triggerReimport = vi.fn().mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      fixture = TestBed.createComponent(ImportAuditComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.triggerReimport();
      expect(mockNotify.error).toHaveBeenCalledOnce();
      expect(component.triggering()).toBe(false);
    });
  });
});
