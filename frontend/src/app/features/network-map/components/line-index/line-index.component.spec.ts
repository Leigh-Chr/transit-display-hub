import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { LineIndexComponent } from './line-index.component';
import { NetworkLine } from '@shared/models';
import { testTranslocoModule } from '../../../../../test-translations';

describe('LineIndexComponent', () => {
  let fixture: ComponentFixture<LineIndexComponent>;
  let component: LineIndexComponent;

  const lines: NetworkLine[] = [
    {
      id: '1', code: 'A', name: 'Bourg → Hôpital', color: '#1976d2',
      textColor: '#ffffff', category: 'Tram', itineraries: [], type: 'TRAM',
    },
    {
      id: '2', code: 'B', name: 'Université ↔ Centre', color: '#43a047',
      textColor: '#ffffff', category: 'Tram', itineraries: [], type: 'TRAM',
    },
    {
      id: '3', code: 'C30', name: 'Gare → Aéroport', color: '#fb8c00',
      textColor: '#000000', category: 'Bus', itineraries: [], type: 'BUS',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LineIndexComponent, testTranslocoModule({})],
    });
    fixture = TestBed.createComponent(LineIndexComponent);
    fixture.componentRef.setInput('lines', lines);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('returns every line when search is empty', () => {
    expect(component.filteredLines().length).toBe(3);
  });

  // toSignal pulls the FormControl's valueChanges asynchronously, so a
  // microtask flush + detectChanges tick is needed after setValue before
  // the filteredLines computed re-evaluates.
  async function flushSearch(): Promise<void> {
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('filters by line code (case-insensitive)', async () => {
    // 'c30' is unique to one code and doesn't appear in any name or
    // category — 'a' alone would also pick up 'Tram' and 'Aéroport'.
    component.searchCtrl.setValue('c30');
    await flushSearch();
    expect(component.filteredLines().map(l => l.code)).toEqual(['C30']);
  });

  it('filters by line name substring', async () => {
    component.searchCtrl.setValue('aéroport');
    await flushSearch();
    expect(component.filteredLines().map(l => l.code)).toEqual(['C30']);
  });

  it('filters by category', async () => {
    component.searchCtrl.setValue('Tram');
    await flushSearch();
    expect(component.filteredLines().map(l => l.code).sort()).toEqual(['A', 'B']);
  });

  it('trims and lower-cases the search term before matching', async () => {
    component.searchCtrl.setValue('  HÔPITAL  ');
    await flushSearch();
    expect(component.filteredLines().map(l => l.code)).toEqual(['A']);
  });

  it('returns an empty list when nothing matches', async () => {
    component.searchCtrl.setValue('zzz-unknown');
    await flushSearch();
    expect(component.filteredLines()).toEqual([]);
  });

  it('treats a missing category as an empty string for matching', async () => {
    const withoutCategory: NetworkLine = {
      id: '4', code: 'D', name: 'NoCat', color: '#000',
      textColor: '#fff', category: null, itineraries: [], type: 'BUS',
    };
    fixture.componentRef.setInput('lines', [...lines, withoutCategory]);

    component.searchCtrl.setValue('D');
    await flushSearch();
    expect(component.filteredLines().map(l => l.code)).toEqual(['D']);
  });

  it('emits lineSelected with the line code on card click', () => {
    let emitted: string | null = null;
    component.lineSelected.subscribe(code => (emitted = code));

    const card = fixture.nativeElement.querySelector('.line-card') as HTMLButtonElement;
    card.click();

    expect(emitted).toBe('A');
  });
});
