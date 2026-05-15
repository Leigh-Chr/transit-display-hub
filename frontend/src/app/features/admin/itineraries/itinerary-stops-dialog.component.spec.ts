import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ItineraryStopsDialogComponent, ItineraryStopsDialogData } from './itinerary-stops-dialog.component';
import { StopService } from '@core/api/stop.service';
import { Itinerary, Stop, UpdateItineraryStopsRequest } from '@shared/models';

const en = {
  common: { cancel: 'Cancel' },
  admin: {
    itineraries: {
      stopsDialog: {
        title: 'Manage Stops - {{ name }}',
        addStop: 'Add a stop',
        addStopHint: 'Select a stop to add to this itinerary',
        noMoreStops: 'No more stops available',
        noStopsYet: 'No stops added yet. Add stops to define the itinerary.',
        terminusLabel: 'Terminus:',
        loadFailed: 'Failed to load stops',
        available: 'Available stops',
        selected: 'Selected stops',
        searchPlaceholder: 'Search a stop…',
        noStopsAvailable: 'No more stops available',
        noStopsSelected: 'No stops added yet. Add stops to define the itinerary.',
        addTooltip: 'Add stop',
        removeTooltip: 'Remove stop',
        moveUpTooltip: 'Move up',
        moveDownTooltip: 'Move down',
        actionSave: 'Save',
      },
    },
  },
};

const fr = {
  common: { cancel: 'Annuler' },
  admin: {
    itineraries: {
      stopsDialog: {
        title: 'Gérer les arrêts - {{ name }}',
        addStop: 'Ajouter un arrêt',
        addStopHint: 'Sélectionnez un arrêt à ajouter à cet itinéraire',
        noMoreStops: 'Plus aucun arrêt disponible',
        noStopsYet: "Aucun arrêt pour l'instant. Ajoutez des arrêts pour définir l'itinéraire.",
        terminusLabel: 'Terminus :',
        loadFailed: 'Échec du chargement des arrêts',
        available: 'Arrêts disponibles',
        selected: 'Arrêts sélectionnés',
        searchPlaceholder: 'Rechercher un arrêt…',
        noStopsAvailable: 'Plus aucun arrêt disponible',
        noStopsSelected: "Aucun arrêt pour l'instant. Ajoutez des arrêts pour définir l'itinéraire.",
        addTooltip: "Ajouter l'arrêt",
        removeTooltip: "Retirer l'arrêt",
        moveUpTooltip: 'Monter',
        moveDownTooltip: 'Descendre',
        actionSave: 'Enregistrer',
      },
    },
  },
};

describe('ItineraryStopsDialogComponent', () => {
  let component: ItineraryStopsDialogComponent;
  let fixture: ComponentFixture<ItineraryStopsDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockStopService: { getAll: ReturnType<typeof vi.fn> };
  let submit: ItineraryStopsDialogData['submit'] & ReturnType<typeof vi.fn>;

  const mockItinerary: Itinerary = {
    id: 'it1',
    name: 'Direction East',
    terminusName: 'East Terminal',
      directionId: null,
    line: { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000' },
    stops: [
      { id: 's1', name: 'First Stop', position: 0 },
      { id: 's2', name: 'Second Stop', position: 1 },
    ],
  };

  const savedItinerary: Itinerary = {
    ...mockItinerary,
    stops: [
      { id: 's1', name: 'First Stop', position: 0 },
      { id: 's2', name: 'Second Stop', position: 1 },
      { id: 's3', name: 'Third Stop', position: 2 },
    ],
  };

  const mockLineStops: Stop[] = [
    { id: 's1', name: 'First Stop', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
    { id: 's2', name: 'Second Stop', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
    { id: 's3', name: 'Third Stop', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
    { id: 's4', name: 'Fourth Stop', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
  ];

  function createComponent(overrides: Partial<ItineraryStopsDialogData> = {}): void {
    mockDialogRef = { close: vi.fn() };
    mockStopService = { getAll: vi.fn().mockReturnValue(of(mockLineStops)) };
    submit = vi.fn().mockReturnValue(of(savedItinerary)) as typeof submit;
    const data: ItineraryStopsDialogData = { itinerary: mockItinerary, submit, ...overrides };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        ItineraryStopsDialogComponent,
        TranslocoTestingModule.forRoot({
          langs: { en, fr },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
        }),
      ],
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

    it('should call submit with the stopIds and close with the server response', () => {
      component.save();

      expect(submit).toHaveBeenCalledWith({
        stopIds: ['s1', 's2'],
      } satisfies UpdateItineraryStopsRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedItinerary);
    });

    it('should call submit with updated stopIds after adding a stop', () => {
      component.addStop('s3');
      component.save();

      expect(submit).toHaveBeenCalledWith({
        stopIds: ['s1', 's2', 's3'],
      } satisfies UpdateItineraryStopsRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedItinerary);
    });

    it('should keep the dialog open and surface the error when submit fails', () => {
      const onError = vi.fn();
      createComponent({ submit: vi.fn().mockReturnValue(throwError(() => new Error('boom'))), onError });

      component.save();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
    });

    it('should ignore subsequent save clicks while the submit is in flight', () => {
      const inFlight = new Subject<Itinerary>();
      createComponent({ submit: vi.fn().mockReturnValue(inFlight) });

      component.save();
      component.save();
      component.save();

      expect(component.submitting()).toBe(true);
      inFlight.next(savedItinerary);
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
      submit = vi.fn().mockReturnValue(of(savedItinerary)) as typeof submit;

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          ItineraryStopsDialogComponent,
          TranslocoTestingModule.forRoot({
            langs: { en, fr },
            translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          }),
        ],
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: { itinerary: mockItinerary, submit } },
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
