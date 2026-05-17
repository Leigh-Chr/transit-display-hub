import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Stop } from '@shared/models';
import { beforeEach, describe, expect, it } from 'vitest';
import { StopAutocompleteComponent } from './stop-autocomplete.component';

function makeStop(over: Partial<Stop>): Stop {
  return {
    id: crypto.randomUUID(),
    name: 'Stop',
    latitude: null,
    longitude: null,
    shortCode: null,
    platformCode: null,
    description: null,
    url: null,
    wheelchairBoarding: null,
    locationType: 0,
    parentStopId: null,
    parentStopName: null,
    zoneId: null,
    stopAccess: null,
    lines: [],
    scheduleCount: 0,
    hasDevice: false,
    ...over,
  };
}

describe('StopAutocompleteComponent', () => {
  let fixture: ComponentFixture<StopAutocompleteComponent>;
  let component: StopAutocompleteComponent;

  const stops: Stop[] = [
    makeStop({ name: 'Châtelet' }),
    makeStop({ name: 'Bastille' }),
    makeStop({ name: 'République' }),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StopAutocompleteComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StopAutocompleteComponent);
    fixture.componentRef.setInput('stops', stops);
    fixture.componentRef.setInput('label', 'Pick a stop');
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  it('shows up to 30 stops when no query is set', () => {
    const filtered = (component as unknown as { filtered: () => Stop[] }).filtered();
    expect(filtered).toHaveLength(3);
  });

  it('filters stops by name (case-insensitive substring)', () => {
    (component as unknown as { onTyped: (s: string) => void }).onTyped('bas');
    const filtered = (component as unknown as { filtered: () => Stop[] }).filtered();
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe('Bastille');
  });

  it('caps the displayed results at 30 even on a huge feed', () => {
    const big: Stop[] = Array.from({ length: 100 }, (_, i) => makeStop({ name: `S${i}` }));
    fixture.componentRef.setInput('stops', big);
    fixture.detectChanges();
    const filtered = (component as unknown as { filtered: () => Stop[] }).filtered();
    expect(filtered).toHaveLength(30);
  });
});
