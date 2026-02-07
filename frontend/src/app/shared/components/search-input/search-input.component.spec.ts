import { TestBed, ComponentFixture } from '@angular/core/testing';
import { SearchInputComponent } from './search-input.component';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('SearchInputComponent', () => {
  let component: SearchInputComponent;
  let fixture: ComponentFixture<SearchInputComponent>;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      imports: [SearchInputComponent],
    });

    fixture = TestBed.createComponent(SearchInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have empty search value by default', () => {
      expect(component.searchValue).toBe('');
    });

    it('should have default placeholder', () => {
      expect(component.placeholder()).toBe('Search...');
    });

    it('should have default debounce of 300ms', () => {
      expect(component.debounceMs()).toBe(300);
    });
  });

  describe('searchChange emission', () => {
    it('should emit after debounce', () => {
      const emitted: string[] = [];
      component.searchChange.subscribe((value: string) => emitted.push(value));

      component.onSearchChange('test');
      expect(emitted.length).toBe(0);

      vi.advanceTimersByTime(300);
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe('test');
    });

    it('should not re-emit identical value (distinctUntilChanged)', () => {
      const emitted: string[] = [];
      component.searchChange.subscribe((value: string) => emitted.push(value));

      component.onSearchChange('test');
      vi.advanceTimersByTime(300);
      expect(emitted.length).toBe(1);

      component.onSearchChange('test');
      vi.advanceTimersByTime(300);
      expect(emitted.length).toBe(1); // Should not have emitted again
    });

    it('should emit new value after change', () => {
      const emitted: string[] = [];
      component.searchChange.subscribe((value: string) => emitted.push(value));

      component.onSearchChange('first');
      vi.advanceTimersByTime(300);

      component.onSearchChange('second');
      vi.advanceTimersByTime(300);

      expect(emitted.length).toBe(2);
      expect(emitted[0]).toBe('first');
      expect(emitted[1]).toBe('second');
    });
  });

  describe('clearSearch', () => {
    it('should clear the search value', () => {
      component.searchValue = 'something';
      component.clearSearch();
      expect(component.searchValue).toBe('');
    });

    it('should emit empty string immediately', () => {
      const emitted: string[] = [];
      component.searchChange.subscribe((value: string) => emitted.push(value));

      component.searchValue = 'something';
      component.clearSearch();

      // clearSearch emits directly, not through debounce
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe('');
    });
  });

  describe('initial value', () => {
    it('should apply initial value on init', () => {
      // Create a new component with initial value
      const newFixture = TestBed.createComponent(SearchInputComponent);
      const newComponent = newFixture.componentInstance;

      // Set input before detectChanges
      TestBed.runInInjectionContext(() => {
        // initialValue is a signal input, we set it via component ref
        (newComponent as unknown as { initialValue: () => string }).initialValue = () => 'initial';
      });

      newFixture.detectChanges();
      // After ngOnInit, searchValue should be set from initialValue
      expect(newComponent.searchValue).toBe('initial');
    });
  });
});
