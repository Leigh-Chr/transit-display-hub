import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { StopAutocompleteComponent, StopAutocompleteOption } from './stop-autocomplete.component';

function makeStop(over: Partial<StopAutocompleteOption>): StopAutocompleteOption {
  return {
    id: crypto.randomUUID(),
    name: 'Stop',
    ...over,
  };
}

describe('StopAutocompleteComponent', () => {
  let fixture: ComponentFixture<StopAutocompleteComponent>;
  let component: StopAutocompleteComponent;

  const stops: StopAutocompleteOption[] = [
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
    const filtered = (component as unknown as { filtered: () => StopAutocompleteOption[] }).filtered();
    expect(filtered).toHaveLength(3);
  });

  it('filters stops by name (case-insensitive substring)', () => {
    (component as unknown as { onTyped: (s: string) => void }).onTyped('bas');
    const filtered = (component as unknown as { filtered: () => StopAutocompleteOption[] }).filtered();
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe('Bastille');
  });

  it('caps the displayed results at 30 even on a huge feed', () => {
    const big: StopAutocompleteOption[] = Array.from({ length: 100 }, (_, i) => makeStop({ name: `S${i}` }));
    fixture.componentRef.setInput('stops', big);
    fixture.detectChanges();
    const filtered = (component as unknown as { filtered: () => StopAutocompleteOption[] }).filtered();
    expect(filtered).toHaveLength(30);
  });

  it('mirrors an externally pushed value into the text query', () => {
    const target = stops[1]!;
    fixture.componentRef.setInput('value', target);
    fixture.detectChanges();
    expect((component as unknown as { searchText: () => string }).searchText()).toBe(target.name);
  });
});
