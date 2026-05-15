import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageDialogComponent, MessageDialogData } from './message-dialog.component';
import { StopService } from '@core/api/stop.service';
import { Line, BroadcastMessage } from '@shared/models';
import { TranslocoTestingModule } from '@jsverse/transloco';

const en = {
  common: { cancel: 'Cancel', delete: 'Delete' },
  admin: {
    messages: {
      severityInfo: 'Info',
      severityWarning: 'Warning',
      severityCritical: 'Critical',
      dialog: {
        titleCreate: 'New Broadcast Message',
        titleEdit: 'Edit Message',
        fieldTitle: 'Title',
        fieldTitlePlaceholder: 'e.g., Service Disruption',
        fieldTitleRequired: 'Title is required',
        fieldContent: 'Content',
        fieldContentPlaceholder: 'Detailed message content…',
        fieldContentRequired: 'Content is required',
        fieldSeverity: 'Severity',
        fieldSeverityRequired: 'Severity is required',
        fieldScope: 'Scope',
        fieldScopeRequired: 'Scope is required',
        scopeNetwork: 'Entire Network',
        scopeLine: 'Specific Line',
        scopeStop: 'Specific Stop',
        fieldLine: 'Line',
        fieldLineRequired: 'Line is required for this scope',
        fieldStop: 'Stop',
        fieldStopRequired: 'Stop is required for this scope',
        fieldStopHint: 'Pick a line first',
        fieldStartTime: 'Start Time',
        fieldStartTimeRequired: 'Start time is required',
        fieldEndTime: 'End Time',
        fieldEndTimeRequired: 'End time is required',
        fieldEndTimeInvalid: 'End time must be after start time',
        actionCreate: 'Create Message',
        actionSave: 'Save Changes',
      },
    },
  },
};

const savedMessage: BroadcastMessage = {
  id: 'm1',
  title: 'Saved',
  content: 'Saved content',
  severity: 'INFO',
  startTime: '2024-01-01T08:00:00Z',
  endTime: '2024-01-02T08:00:00Z',
  scopeType: 'NETWORK',
  scopeId: null,
  scopeInfo: null,
  active: true,
};

describe('MessageDialogComponent', () => {
  let component: MessageDialogComponent;
  let fixture: ComponentFixture<MessageDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockStopService: { getAll: ReturnType<typeof vi.fn> };
  let submit: MessageDialogData['submit'] & ReturnType<typeof vi.fn>;

  const mockLines: Line[] = [
    { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, stopCount: 5, itineraryCount: 2 },
  ];

  function createComponent(overrides: Partial<MessageDialogData> = {}): void {
    mockDialogRef = { close: vi.fn() };
    mockStopService = { getAll: vi.fn().mockReturnValue(of([])) };
    submit = vi.fn().mockReturnValue(of(savedMessage)) as typeof submit;
    const data: MessageDialogData = { lines: mockLines, submit, ...overrides };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        MessageDialogComponent,
        TranslocoTestingModule.forRoot({
          langs: { en, fr: en },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
        }),
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: StopService, useValue: mockStopService },
      ],
    });

    fixture = TestBed.createComponent(MessageDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('create mode', () => {
    beforeEach(() => createComponent());

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should display "New Broadcast Message" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('New Broadcast Message');
    });

    it('should initialize form with default values', () => {
      expect(component.form.title).toBe('');
      expect(component.form.content).toBe('');
      expect(component.form.severity).toBe('INFO');
      expect(component.form.scopeType).toBe('NETWORK');
      expect(component.form.lineId).toBe('');
      expect(component.form.stopId).toBe('');
      expect(component.form.startTime).toBeTruthy();
      expect(component.form.endTime).toBeTruthy();
    });

    it('should show "Create Message" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Create Message');
    });

    it('should have submit button disabled when form is invalid (empty required fields)', () => {
      component.form.title = '';
      component.form.content = '';
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.disabled).toBe(true);
    });

    it('should call submit with the form payload and close with the server response', () => {
      component.form.title = 'Service Alert';
      component.form.content = 'Line delayed';
      component.form.severity = 'WARNING';
      component.form.scopeType = 'NETWORK';
      component.form.startTime = '2024-01-01T08:00';
      component.form.endTime = '2024-01-01T18:00';

      component.save();

      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Service Alert',
          content: 'Line delayed',
          severity: 'WARNING',
          scopeType: 'NETWORK',
          scopeId: undefined,
        }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedMessage);
    });

    it('should keep the dialog open and surface the error when submit fails', () => {
      const onError = vi.fn();
      createComponent({ submit: vi.fn().mockReturnValue(throwError(() => new Error('boom'))), onError });
      component.form.title = 'Service Alert';
      component.form.content = 'Line delayed';
      component.form.severity = 'WARNING';
      component.form.scopeType = 'NETWORK';
      component.form.startTime = '2024-01-01T08:00';
      component.form.endTime = '2024-01-01T18:00';

      component.save();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
    });

    it('should ignore subsequent save clicks while the submit is in flight', () => {
      const inFlight = new Subject<BroadcastMessage>();
      createComponent({ submit: vi.fn().mockReturnValue(inFlight) });
      component.form.title = 'Service Alert';
      component.form.content = 'Line delayed';
      component.form.severity = 'WARNING';
      component.form.scopeType = 'NETWORK';
      component.form.startTime = '2024-01-01T08:00';
      component.form.endTime = '2024-01-01T18:00';

      component.save();
      component.save();
      component.save();

      expect(component.submitting()).toBe(true);
      inFlight.next(savedMessage);
      inFlight.complete();
      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should close dialog without data when cancel is clicked', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const cancelBtn = buttons[0];

      cancelBtn.click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it('should validate date range - end must be after start', () => {
      component.form.startTime = '2024-01-02T08:00';
      component.form.endTime = '2024-01-01T08:00';

      expect(component.isDateRangeValid()).toBe(false);
    });

    it('should accept valid date range', () => {
      component.form.startTime = '2024-01-01T08:00';
      component.form.endTime = '2024-01-02T08:00';

      expect(component.isDateRangeValid()).toBe(true);
    });

    it('should return true when dates are empty', () => {
      component.form.startTime = '';
      component.form.endTime = '';

      expect(component.isDateRangeValid()).toBe(true);
    });
  });

  describe('scope behavior', () => {
    beforeEach(() => createComponent());

    it('should clear lineId and stopId when scope changes to NETWORK', () => {
      component.form.lineId = 'line1';
      component.form.stopId = 'stop1';
      component.form.scopeType = 'NETWORK';

      component.onScopeChange();

      expect(component.form.lineId).toBe('');
      expect(component.form.stopId).toBe('');
    });

    it('should clear stopId when scope changes to LINE', () => {
      component.form.stopId = 'stop1';
      component.form.scopeType = 'LINE';

      component.onScopeChange();

      expect(component.form.stopId).toBe('');
    });

    it('should load stops when line changes', () => {
      component.form.lineId = 'line1';
      component.onLineChange();

      expect(mockStopService.getAll).toHaveBeenCalledWith('line1');
    });

    it('should clear stops when line is cleared', () => {
      component.form.lineId = '';
      component.onLineChange();

      expect(component.stops()).toEqual([]);
    });

    it('should pass lineId as scopeId for LINE scope on save', () => {
      component.form.title = 'Alert';
      component.form.content = 'Content';
      component.form.severity = 'INFO';
      component.form.scopeType = 'LINE';
      component.form.lineId = 'line1';
      component.form.startTime = '2024-01-01T08:00';
      component.form.endTime = '2024-01-02T08:00';

      component.save();

      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          scopeType: 'LINE',
          scopeId: 'line1',
        }),
      );
    });

    it('should pass stopId as scopeId for STOP scope on save', () => {
      component.form.title = 'Alert';
      component.form.content = 'Content';
      component.form.severity = 'INFO';
      component.form.scopeType = 'STOP';
      component.form.stopId = 'stop1';
      component.form.startTime = '2024-01-01T08:00';
      component.form.endTime = '2024-01-02T08:00';

      component.save();

      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          scopeType: 'STOP',
          scopeId: 'stop1',
        }),
      );
    });
  });

  describe('edit mode', () => {
    const existingMessage: BroadcastMessage = {
      id: 'msg1',
      title: 'Planned Maintenance',
      content: 'Service will be disrupted',
      severity: 'WARNING',
      startTime: '2024-06-01T08:00:00Z',
      endTime: '2024-06-01T18:00:00Z',
      scopeType: 'LINE',
      scopeId: 'line1',
      scopeInfo: { name: 'Line 1' },
      active: true,
    };

    beforeEach(() => createComponent({ message: existingMessage }));

    it('should display "Edit Message" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('Edit Message');
    });

    it('should pre-populate form fields from dialog data', () => {
      expect(component.form.title).toBe('Planned Maintenance');
      expect(component.form.content).toBe('Service will be disrupted');
      expect(component.form.severity).toBe('WARNING');
      expect(component.form.scopeType).toBe('LINE');
    });

    it('should show "Save Changes" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Save Changes');
    });
  });
});
