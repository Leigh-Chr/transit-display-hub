import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SchematicMapComponent } from './schematic-map.component';
import { LayoutStop } from '../../services/schematic-layout.service';
import { NetworkLine } from '@shared/models';
import { testTranslocoModule } from '../../../../../test-translations';

/**
 * Shared fixtures, dictionary and TestBed setup for every
 * `schematic-map` spec file. The component spec was the second
 * largest spec in the project (~950 lines, 81 tests) so it was
 * split across several files by domain — every file imports
 * {@link setupSchematicMapFixture} to skip the boilerplate.
 *
 * Asserted-against strings live in this dictionary; key-only
 * lookups (where the test only cares the t() pipe rendered
 * *something*) are left to the Transloco fallback that ships the
 * key as-is.
 */
const SCHEMATIC_MAP_TRANSLATIONS = {
  map: {
    schematic: {
      emptySelection: 'Select a line',
      zoneOverlayLabel: 'Zones',
      zoneRowLabel: 'Zones:',
      zoneRowAll: 'All',
      diagramAriaLabel: 'Network schematic',
      svgAriaLabel: 'Network schematic diagram',
      wheelHint: 'Ctrl + scroll to zoom',
      accessibilityToggle: { enable: 'PMR filter on', disable: 'PMR filter off' },
      zoneOverlayToggle: { show: 'Show zones', hide: 'Hide zones' },
    },
  },
};

export const MOCK_STOPS: LayoutStop[] = [
  { id: 's1', name: 'Alpha', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 80, y: 500 },
  { id: 's2', name: 'Transfer', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1', 'L2'], x: 500, y: 500 },
  { id: 's3', name: 'Bravo', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 920, y: 500 },
  { id: 's4', name: 'Charlie', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L2'], x: 80, y: 600 },
  { id: 's5', name: 'Delta', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L2'], x: 920, y: 600 },
];

const MOCK_LINES: NetworkLine[] = [
  { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, itineraries: [['s1', 's2', 's3']] },
  { id: 'line2', code: 'L2', name: 'Line 2', color: '#0000FF', type: null, itineraries: [['s4', 's2', 's5']] },
];

const MOCK_LINE_COLOR_MAP = new Map<string, string>([
  ['L1', '#FF0000'],
  ['L2', '#0000FF'],
]);

/** Three-stop L1 route reused by the overlay / arrows / marker / active-stop tests. */
export const ROUTE_S1_S2_S3 = {
  segments: [{
    lineId: 'line1',
    lineCode: 'L1',
    lineColor: '#FF0000',
    stopIds: ['s1', 's2', 's3'],
    stopNames: ['Alpha', 'Transfer', 'Bravo'],
    directionName: 'Bravo',
  }],
  transfers: 0,
  transferStopIds: [],
  allStopIds: ['s1', 's2', 's3'],
} as const;

export interface SchematicMapFixture {
  component: SchematicMapComponent;
  fixture: ComponentFixture<SchematicMapComponent>;
}

/**
 * Boot a `SchematicMapComponent` with the standard L1/L2 fixture
 * (5 stops, 2 lines, both visible). Returns the component and the
 * Angular test fixture; tests can call `setInput` to override
 * `visibleLineCodes`, `selectedStopId`, etc. before
 * `fixture.detectChanges()`.
 */
export function setupSchematicMapFixture(): SchematicMapFixture {
  TestBed.configureTestingModule({
    imports: [
      SchematicMapComponent,
      testTranslocoModule(SCHEMATIC_MAP_TRANSLATIONS),
    ],
    providers: [provideRouter([])], // ngxtension's linkedQueryParam needs ActivatedRoute
  });

  const fixture = TestBed.createComponent(SchematicMapComponent);
  const component = fixture.componentInstance;

  fixture.componentRef.setInput('lines', MOCK_LINES);
  fixture.componentRef.setInput('stops', MOCK_STOPS);
  fixture.componentRef.setInput('lineColorMap', MOCK_LINE_COLOR_MAP);
  fixture.componentRef.setInput('visibleLineCodes', ['L1', 'L2']);

  return { component, fixture };
}
