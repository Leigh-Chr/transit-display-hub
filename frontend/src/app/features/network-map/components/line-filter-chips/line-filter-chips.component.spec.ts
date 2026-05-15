import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { LineFilterChipsComponent } from './line-filter-chips.component';
import { MessageSeverity, NetworkLine } from '@shared/models';

const filterDict = {
  map: {
    lineFilter: {
      all: 'All',
      selectAria: 'Filter by line',
      categoryAria: 'Filter by line type',
      chipTitle: 'Click to toggle {{ code }} · double-click to focus',
    },
  },
};

describe('LineFilterChipsComponent', () => {
  let fixture: ComponentFixture<LineFilterChipsComponent>;
  let component: LineFilterChipsComponent;

  const lines: NetworkLine[] = [
    { id: 'l1', code: 'A', name: 'Line A', color: '#FF0000', type: null, itineraries: [] },
    { id: 'l2', code: 'B', name: 'Line B', color: '#0000FF', type: null, itineraries: [] },
    { id: 'l3', code: 'C', name: 'Line C', color: '#00FF00', type: null, itineraries: [] },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        LineFilterChipsComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: filterDict, fr: filterDict },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    });
    fixture = TestBed.createComponent(LineFilterChipsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('lines', lines);
    fixture.componentRef.setInput('visibleLineCodes', ['A', 'B', 'C']);
    fixture.detectChanges();
  });

  function chips(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.filter-chip:not(.all-chip)') as NodeListOf<HTMLButtonElement>);
  }

  it('renders one chip per line plus the All chip', () => {
    const all = fixture.nativeElement.querySelectorAll('.filter-chip').length;
    expect(all).toBe(lines.length + 1);
  });

  it('marks the All chip active when every line is visible', () => {
    const allChip = fixture.nativeElement.querySelector('.all-chip') as HTMLElement;
    expect(allChip.classList.contains('active')).toBe(true);
  });

  it('marks only the visible chips as active', () => {
    fixture.componentRef.setInput('visibleLineCodes', ['A']);
    fixture.detectChanges();

    const active = chips().filter(c => c.classList.contains('active')).map(c => c.textContent.trim());
    expect(active).toEqual(['A']);
  });

  it('emits lineToggle on single click', () => {
    const spy = vi.fn();
    component.lineToggle.subscribe(spy);

    chips()[0]!.click();

    expect(spy).toHaveBeenCalledWith('A');
  });

  it('emits focusLine on double click', () => {
    const spy = vi.fn();
    component.focusLine.subscribe(spy);

    chips()[1]!.dispatchEvent(new MouseEvent('dblclick'));

    expect(spy).toHaveBeenCalledWith('B');
  });

  it('emits toggleAll when the All chip is clicked', () => {
    const spy = vi.fn();
    component.toggleAll.subscribe(spy);

    (fixture.nativeElement.querySelector('.all-chip') as HTMLElement).click();

    expect(spy).toHaveBeenCalled();
  });

  it('renders an alert dot only on chips whose line has an active alert', () => {
    const severityMap = new Map<string, MessageSeverity>([
      ['l2', 'CRITICAL'],
    ]);
    fixture.componentRef.setInput('alertSeverityByLineId', severityMap);
    fixture.detectChanges();

    const chipDots = chips().map(c => c.querySelector('.chip-alert-dot'));
    expect(chipDots[0]).toBeNull();
    expect(chipDots[1]).not.toBeNull();
    expect(chipDots[1]!.classList.contains('chip-alert-dot-critical')).toBe(true);
    expect(chipDots[2]).toBeNull();
  });
});
