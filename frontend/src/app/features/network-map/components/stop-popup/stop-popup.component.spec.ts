import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { StopPopupComponent, StopPopupData } from './stop-popup.component';
import { ScheduleService } from '@core/api/schedule.service';
import { Schedule } from '@shared/models';
import { LayoutStop } from '../../services/schematic-layout.service';

describe('StopPopupComponent', () => {
  let component: StopPopupComponent;
  let fixture: ComponentFixture<StopPopupComponent>;
  let mockScheduleService: { getForStop: ReturnType<typeof vi.fn> };

  const mockStop: LayoutStop = {
    id: 'stop-1',
    name: 'Central Station',
    latitude: 48.85,
    longitude: 2.35,
    schematicX: 100,
    schematicY: 200,
    lineCodes: ['M1', 'M4'],
    x: 100,
    y: 200,
  };

  const mockLineColorMap = new Map<string, string>([
    ['M1', '#FFCD00'],
    ['M4', '#BB4D98'],
  ]);

  const baseMockData: StopPopupData = {
    stop: mockStop,
    lineColorMap: mockLineColorMap,
    networkAlerts: [],
    stopAlerts: [],
    lineAlerts: [],
  };

  const now = new Date();
  const futureHour = now.getHours() + 2;
  const futureTimeStr = `${String(futureHour).padStart(2, '0')}:30:00`;
  const pastTimeStr = `${String(Math.max(0, now.getHours() - 2)).padStart(2, '0')}:15:00`;

  const mockSchedules: Schedule[] = [
    {
      id: 'sched-1',
      time: futureTimeStr,
      stopId: 'stop-1',
      itinerary: {
        id: 'it-1',
        name: 'Line M1 - North',
        terminusName: 'North Station',
        line: { code: 'M1', name: 'Metro 1', color: '#FFCD00' },
      },
    },
    {
      id: 'sched-2',
      time: pastTimeStr,
      stopId: 'stop-1',
      itinerary: {
        id: 'it-1',
        name: 'Line M1 - North',
        terminusName: 'North Station',
        line: { code: 'M1', name: 'Metro 1', color: '#FFCD00' },
      },
    },
  ];

  function createComponent(data: Partial<StopPopupData> = {}): void {
    const dialogData = { ...baseMockData, ...data };

    TestBed.configureTestingModule({
      imports: [StopPopupComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: ScheduleService, useValue: mockScheduleService },
      ],
    });

    fixture = TestBed.createComponent(StopPopupComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    mockScheduleService = {
      getForStop: vi.fn().mockReturnValue(of(mockSchedules)),
    };
  });

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should display the stop name', async () => {
    createComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
    expect(title.textContent.trim()).toBe('Central Station');
  });

  it('should display line badges for all line codes', async () => {
    createComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    const badges = fixture.nativeElement.querySelectorAll('.line-badges .line-badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent.trim()).toBe('M1');
    expect(badges[1].textContent.trim()).toBe('M4');
  });

  it('should load schedules on init', () => {
    createComponent();
    fixture.detectChanges();

    expect(mockScheduleService.getForStop).toHaveBeenCalledWith('stop-1');
  });

  it('should build timetable groups from schedules', async () => {
    createComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.loading()).toBe(false);
    expect(component.timetableGroups().length).toBeGreaterThan(0);

    const group = component.timetableGroups()[0];
    expect(group.lineCode).toBe('M1');
    expect(group.directionName).toBe('North Station');
    expect(group.times.length).toBe(2);
  });

  it('should show loading state initially', () => {
    mockScheduleService.getForStop = vi.fn().mockReturnValue(of(mockSchedules));
    createComponent();
    // Before detectChanges, loading is true
    expect(component.loading()).toBe(true);
  });

  it('should show error state when schedule loading fails', async () => {
    mockScheduleService.getForStop = vi.fn().mockReturnValue(throwError(() => new Error('Network error')));
    createComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.error()).toBe('Failed to load schedules');
    expect(component.loading()).toBe(false);
  });

  it('should show empty state when no schedules exist', async () => {
    mockScheduleService.getForStop = vi.fn().mockReturnValue(of([]));
    createComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.timetableGroups().length).toBe(0);

    const emptyEl = fixture.nativeElement.querySelector('.empty');
    expect(emptyEl).toBeTruthy();
    expect(emptyEl.textContent).toContain('No scheduled departures');
  });

  it('should return correct line color from lineColorMap', () => {
    createComponent();
    fixture.detectChanges();

    expect(component.getLineColor('M1')).toBe('#FFCD00');
    expect(component.getLineColor('M4')).toBe('#BB4D98');
    expect(component.getLineColor('UNKNOWN')).toBe('#666');
  });

  it('should return correct message icon for each severity', () => {
    createComponent();

    expect(component.getMessageIcon('CRITICAL')).toBe('error');
    expect(component.getMessageIcon('WARNING')).toBe('warning');
    expect(component.getMessageIcon('INFO')).toBe('info');
    expect(component.getMessageIcon('OTHER')).toBe('info');
  });

  describe('messages', () => {
    it('should display no messages when there are none', async () => {
      createComponent();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.messages().length).toBe(0);
      const messageSection = fixture.nativeElement.querySelector('.messages-section');
      expect(messageSection).toBeFalsy();
    });

    it('should combine and sort messages from all alert sources by severity', async () => {
      createComponent({
        networkAlerts: [{ title: 'Network Info', content: 'Info text', severity: 'INFO' }],
        stopAlerts: [{ title: 'Stop Critical', content: 'Critical text', severity: 'CRITICAL' }],
        lineAlerts: [
          { lineCode: 'M1', lineColor: '#FFCD00', title: 'Line Warning', content: 'Warn text', severity: 'WARNING' },
        ],
      });
      fixture.detectChanges();
      await fixture.whenStable();

      const messages = component.messages();
      expect(messages.length).toBe(3);
      // Should be sorted: CRITICAL, WARNING, INFO
      expect(messages[0].severity).toBe('CRITICAL');
      expect(messages[1].severity).toBe('WARNING');
      expect(messages[2].severity).toBe('INFO');
    });

    it('should render message cards in the template', async () => {
      createComponent({
        stopAlerts: [{ title: 'Delay', content: 'Service delayed', severity: 'WARNING' }],
      });
      fixture.detectChanges();
      await fixture.whenStable();

      const messageCards = fixture.nativeElement.querySelectorAll('.message-card');
      expect(messageCards.length).toBe(1);
      expect(messageCards[0].textContent).toContain('Delay');
    });
  });
});
