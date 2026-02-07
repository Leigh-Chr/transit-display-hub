import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ItineraryStopsDialogComponent, ItineraryStopsDialogData } from './itinerary-stops-dialog.component';
import { StopService } from '@core/api/stop.service';
import { Itinerary, Stop } from '@shared/models';

describe('ItineraryStopsDialogComponent', () => {
  let component: ItineraryStopsDialogComponent;
  let fixture: ComponentFixture<ItineraryStopsDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockStopService: { getAll: ReturnType<typeof vi.fn> };

  const mockItinerary: Itinerary = {
    id: 'it1',
    name: 'Direction East',
    terminusName: 'East Terminal',
    line: { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000' },
    stops: [
      { id: 's1', name: 'First Stop', position: 0 },
      { id: 's2', name: 'Second Stop', position: 1 },
    ],
  };

  const mockLineStops: Stop[] = [
    { id: 's1', name: 'First Stop', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
    { id: 's2', name: 'Second Stop', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
    { id: 's3', name: 'Third Stop', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
    { id: 's4', name: 'Fourth Stop', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
  ];

  function createComponent(data: ItineraryStopsDialogData = { itinerary: mockItinerary }): void {
    mockDialogRef = { close: vi.fn() };
    mockStopService = { getAll: vi.fn().mockReturnValue(of(mockLineStops)) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ItineraryStopsDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: StopService, useValue: mockStopService },
      ],
    });

    fixture = TestBed.createComponent(ItineraryStopsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('initialization', () => {
    beforeEach(() => createComponent());

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should display the itinerary name in the title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('Direction East');
    });

    it('should load stops from the line on init', () => {
      expect(mockStopService.getAll).toHaveBeenCalledWith('line1');
    });

    it('should set loading to false after stops are loaded', () => {
      expect(component.loading()).toBe(false);
    });

    it('should initialize selected stops from itinerary data', () => {
      const selected = component.selectedStops();
      expect(selected).toEqual([
        { id: 's1', name: 'First Stop' },
        { id: 's2', name: 'Second Stop' },
      ]);
    });

    it('should compute available stops excluding selected ones', () => {
      const available = component.availableStops();
      expect(available.length).toBe(2);
      expect(available.map(s => s.id)).toEqual(['s3', 's4']);
    });
  });

  describe('adding and removing stops', () => {
    beforeEach(() => createComponent());

    it('should add a stop to selected and remove from available', () => {
      component.addStop('s3');

      expect(component.selectedStops().length).toBe(3);
      expect(component.selectedStops()[2]).toEqual({ id: 's3', name: 'Third Stop' });
      expect(component.availableStops().length).toBe(1);
    });

    it('should not add a stop with empty id', () => {
      const initialLength = component.selectedStops().length;
      component.addStop('');
      expect(component.selectedStops().length).toBe(initialLength);
    });

    it('should remove a stop from selected and make it available again', () => {
      component.removeStop(0);

      expect(component.selectedStops().length).toBe(1);
      expect(component.selectedStops()[0]!.id).toBe('s2');
      expect(component.availableStops().length).toBe(3);
    });
  });

  describe('save and cancel', () => {
    beforeEach(() => createComponent());

    it('should close dialog with stopIds on save', () => {
      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        stopIds: ['s1', 's2'],
      });
    });

    it('should close dialog with updated stopIds after adding a stop', () => {
      component.addStop('s3');
      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        stopIds: ['s1', 's2', 's3'],
      });
    });

    it('should close dialog without data when cancel is clicked', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const cancelBtn = buttons[0];

      cancelBtn.click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });

  describe('empty itinerary', () => {
    it('should handle itinerary with no stops', () => {
      const emptyItinerary: Itinerary = {
        ...mockItinerary,
        stops: [],
      };

      createComponent({ itinerary: emptyItinerary });

      expect(component.selectedStops()).toEqual([]);
      expect(component.availableStops().length).toBe(4);
    });

    it('should show empty message when no stops are selected', () => {
      const emptyItinerary: Itinerary = {
        ...mockItinerary,
        stops: [],
      };

      createComponent({ itinerary: emptyItinerary });

      const emptyMsg = fixture.nativeElement.querySelector('.empty-message');
      expect(emptyMsg).toBeTruthy();
      expect(emptyMsg.textContent).toContain('No stops added yet');
    });
  });

  describe('error handling', () => {
    it('should set loading to false when stop loading fails', () => {
      mockDialogRef = { close: vi.fn() };
      mockStopService = { getAll: vi.fn().mockReturnValue(throwError(() => new Error('Network error'))) };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ItineraryStopsDialogComponent],
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: { itinerary: mockItinerary } },
          { provide: MatDialogRef, useValue: mockDialogRef },
          { provide: StopService, useValue: mockStopService },
        ],
      });

      fixture = TestBed.createComponent(ItineraryStopsDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });
  });
});
