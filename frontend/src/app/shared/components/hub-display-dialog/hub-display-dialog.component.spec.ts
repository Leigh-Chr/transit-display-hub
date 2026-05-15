import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import {
  HubDisplayDialogComponent,
  HubDisplayDialogData,
} from './hub-display-dialog.component';
import { StopService } from '@core/api/stop.service';
import { Line, Stop } from '@shared/models';

const en = {
  common: { cancel: 'Cancel' },
  admin: {
    hubDisplay: {
      title: 'Open Hub Display',
      filterByLine: 'Filter by Line',
      allLines: 'All Lines',
      searchStops: 'Search stops…',
      loadingStops: 'Loading stops…',
      noStopsMatch: 'No stops match your filters',
      selected: 'Selected ({{ count }}): {{ names }}',
      hubName: 'Hub name',
      openHub: 'Open Hub Display',
    },
  },
};

const fr = {
  common: { cancel: 'Annuler' },
  admin: {
    hubDisplay: {
      title: "Ouvrir l'affichage pôle",
      filterByLine: 'Filtrer par ligne',
      allLines: 'Toutes les lignes',
      searchStops: 'Rechercher des arrêts…',
      loadingStops: 'Chargement des arrêts…',
      noStopsMatch: 'Aucun arrêt ne correspond aux filtres',
      selected: 'Sélectionnés ({{ count }}) : {{ names }}',
      hubName: 'Nom du pôle',
      openHub: "Ouvrir l'affichage pôle",
    },
  },
};

const lineA: Line = { id: 'line-a', code: 'A', name: 'Line A', color: '#FF0000', type: null, stopCount: 2, itineraryCount: 1 };
const lineB: Line = { id: 'line-b', code: 'B', name: 'Line B', color: '#00FF00', type: null, stopCount: 1, itineraryCount: 1 };

const stopAlpha: Stop = {
  id: 'stop-alpha',
  name: 'Alpha',
  latitude: 48.0, longitude: 2.0,
  lines: [{ id: 'line-a', code: 'A', name: 'Line A', color: '#FF0000' }],
  scheduleCount: 0, hasDevice: false,
};
const stopBeta: Stop = {
  id: 'stop-beta',
  name: 'Beta',
  latitude: 48.1, longitude: 2.1,
  lines: [{ id: 'line-a', code: 'A', name: 'Line A', color: '#FF0000' }],
  scheduleCount: 0, hasDevice: false,
};
const stopGamma: Stop = {
  id: 'stop-gamma',
  name: 'Gamma',
  latitude: 48.2, longitude: 2.2,
  lines: [{ id: 'line-b', code: 'B', name: 'Line B', color: '#00FF00' }],
  scheduleCount: 0, hasDevice: false,
};

describe('HubDisplayDialogComponent', () => {
  let component: HubDisplayDialogComponent;
  let fixture: ComponentFixture<HubDisplayDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockStopService: { getAll: ReturnType<typeof vi.fn> };

  function createComponent(
    data: HubDisplayDialogData = { lines: [lineA, lineB] },
    stops: Stop[] = [stopAlpha, stopBeta, stopGamma],
  ): void {
    mockDialogRef = { close: vi.fn() };
    mockStopService = { getAll: vi.fn().mockReturnValue(of(stops)) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        HubDisplayDialogComponent,
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

    fixture = TestBed.createComponent(HubDisplayDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    createComponent();
  });

  describe('rendering', () => {
    it('renders the localized title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent.trim()).toBe('Open Hub Display');
    });

    it('lists all loaded stops once getAll resolves', () => {
      const items = fixture.nativeElement.querySelectorAll('.stop-name');
      expect(items.length).toBe(3);
      const names = Array.from(items).map((n) => (n as HTMLElement).textContent.trim());
      expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('keeps the confirm button disabled while fewer than two stops are selected', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const confirm = buttons[1] as HTMLButtonElement;
      expect(confirm.disabled).toBe(true);

      component.toggleStop('stop-alpha');
      fixture.detectChanges();
      expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);

      component.toggleStop('stop-beta');
      fixture.detectChanges();
      expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('selection and auto-naming', () => {
    it('toggles a stop in and out of the selection', () => {
      component.toggleStop('stop-alpha');
      expect(component.selectedIds().has('stop-alpha')).toBe(true);
      component.toggleStop('stop-alpha');
      expect(component.selectedIds().has('stop-alpha')).toBe(false);
    });

    it('auto-derives the hub name from the selected stops', () => {
      component.toggleStop('stop-alpha');
      component.toggleStop('stop-beta');
      fixture.detectChanges();
      expect(component.hubName()).toBe('Alpha / Beta');
    });
  });

  describe('preselection', () => {
    it('preselects the stops passed in via data', () => {
      createComponent({ lines: [lineA, lineB], preselectedStopIds: ['stop-alpha', 'stop-gamma'] });
      expect(component.selectedIds().has('stop-alpha')).toBe(true);
      expect(component.selectedIds().has('stop-gamma')).toBe(true);
      expect(component.selectedIds().has('stop-beta')).toBe(false);
    });
  });

  describe('confirm', () => {
    it('closes the dialog with the selected ids and hub name', () => {
      component.toggleStop('stop-alpha');
      component.toggleStop('stop-beta');
      fixture.detectChanges();
      component.confirm();
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        stopIds: ['stop-alpha', 'stop-beta'],
        hubName: 'Alpha / Beta',
      });
    });
  });
});
