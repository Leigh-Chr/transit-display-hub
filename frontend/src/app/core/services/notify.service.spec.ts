import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SNACKBAR_DURATIONS } from '../../shared/utils/snackbar.constants';
import { NotifyService } from './notify.service';

describe('NotifyService', () => {
  function setup(): { service: NotifyService; open: ReturnType<typeof vi.fn>; actionSubject: Subject<void> } {
    const actionSubject = new Subject<void>();
    const open = vi.fn().mockReturnValue({ onAction: () => EMPTY });
    TestBed.configureTestingModule({
      providers: [
        NotifyService,
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    return { service: TestBed.inject(NotifyService), open, actionSubject };
  }

  it('success uses success-snackbar panel class', () => {
    const { service, open } = setup();
    service.success('Created');
    expect(open).toHaveBeenCalledWith('Created', 'OK', expect.objectContaining({ panelClass: 'success-snackbar' }));
  });

  it('success uses success duration', () => {
    const { service, open } = setup();
    service.success('Created');
    expect(open).toHaveBeenCalledWith('Created', 'OK', expect.objectContaining({ duration: SNACKBAR_DURATIONS.success }));
  });

  it('info uses info-snackbar panel class', () => {
    const { service, open } = setup();
    service.info('Note');
    expect(open).toHaveBeenCalledWith('Note', 'OK', expect.objectContaining({ panelClass: 'info-snackbar' }));
  });

  it('warn uses warning-snackbar panel class', () => {
    const { service, open } = setup();
    service.warn('Watch out');
    expect(open).toHaveBeenCalledWith('Watch out', 'OK', expect.objectContaining({ panelClass: 'warning-snackbar' }));
  });

  it('error uses error-snackbar panel class', () => {
    const { service, open } = setup();
    service.error('Failed');
    expect(open).toHaveBeenCalledWith('Failed', 'OK', expect.objectContaining({ panelClass: 'error-snackbar' }));
  });

  it('error with retryable uses Retry button label', () => {
    const { service, open } = setup();
    service.error('Failed', { retryable: true });
    expect(open).toHaveBeenCalledWith('Failed', 'Retry', expect.objectContaining({ panelClass: 'error-snackbar' }));
  });

  it('error with retryable uses retryable duration', () => {
    const { service, open } = setup();
    service.error('Failed', { retryable: true });
    expect(open).toHaveBeenCalledWith('Failed', 'Retry', expect.objectContaining({ duration: SNACKBAR_DURATIONS.retryable }));
  });

  it('error without retryable uses OK button', () => {
    const { service, open } = setup();
    service.error('Failed');
    expect(open).toHaveBeenCalledWith('Failed', 'OK', expect.objectContaining({ panelClass: 'error-snackbar' }));
  });

  it('errorRetryable opens Retry snackbar and returns onAction observable', () => {
    const actionSubject = new Subject<void>();
    const open = vi.fn().mockReturnValue({ onAction: () => actionSubject.asObservable() });
    TestBed.configureTestingModule({
      providers: [
        NotifyService,
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    const service = TestBed.inject(NotifyService);
    const retried = vi.fn();
    service.errorRetryable('Load failed').subscribe(retried);
    expect(open).toHaveBeenCalledWith('Load failed', 'Retry', expect.objectContaining({
      duration: SNACKBAR_DURATIONS.retryable,
      panelClass: 'error-snackbar',
    }));
    actionSubject.next();
    expect(retried).toHaveBeenCalledOnce();
  });
});
