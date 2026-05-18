import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { A11yToolbarComponent } from './a11y-toolbar.component';
import { ThemeService } from '@core/services/theme.service';
import { testTranslocoModule } from '../../../../test-translations';

const dict = {
  a11yToolbar: {
    groupLabel: 'Accessibility',
    highContrast: 'High contrast',
    largeText: 'Larger text',
    speak: 'Announce next departure',
  },
};

describe('A11yToolbarComponent', () => {
  let fixture: ComponentFixture<A11yToolbarComponent>;
  let mockTheme: {
    isHighContrast: ReturnType<typeof signal<boolean>>;
    isLargeText: ReturnType<typeof signal<boolean>>;
    toggleHighContrast: ReturnType<typeof vi.fn>;
    toggleLargeText: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockTheme = {
      isHighContrast: signal(false),
      isLargeText: signal(false),
      toggleHighContrast: vi.fn(),
      toggleLargeText: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [A11yToolbarComponent, testTranslocoModule(dict)],
      providers: [{ provide: ThemeService, useValue: mockTheme }],
    });

    fixture = TestBed.createComponent(A11yToolbarComponent);
  });

  it('renders the high-contrast and large-text buttons by default', () => {
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });

  it('omits the speech button unless showSpeech is true', () => {
    fixture.componentRef.setInput('showSpeech', false);
    fixture.detectChanges();
    const icons = Array.from(
      fixture.nativeElement.querySelectorAll('mat-icon') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent.trim());
    expect(icons).not.toContain('volume_up');
  });

  it('renders the speech button when showSpeech is true', () => {
    fixture.componentRef.setInput('showSpeech', true);
    fixture.detectChanges();
    const icons = Array.from(
      fixture.nativeElement.querySelectorAll('mat-icon') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent.trim());
    expect(icons).toContain('volume_up');
  });

  it('omits the high-contrast button when showHighContrast is false', () => {
    fixture.componentRef.setInput('showHighContrast', false);
    fixture.detectChanges();
    const icons = Array.from(
      fixture.nativeElement.querySelectorAll('mat-icon') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent.trim());
    expect(icons).not.toContain('contrast');
  });

  it('omits the large-text button when showLargeText is false', () => {
    fixture.componentRef.setInput('showLargeText', false);
    fixture.detectChanges();
    const icons = Array.from(
      fixture.nativeElement.querySelectorAll('mat-icon') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent.trim());
    expect(icons).not.toContain('format_size');
  });

  it('calls themeService.toggleHighContrast on click', () => {
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector(
      'button[aria-label="High contrast"]',
    ) as HTMLButtonElement;
    btn.click();
    expect(mockTheme.toggleHighContrast).toHaveBeenCalledOnce();
  });

  it('calls themeService.toggleLargeText on click', () => {
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector(
      'button[aria-label="Larger text"]',
    ) as HTMLButtonElement;
    btn.click();
    expect(mockTheme.toggleLargeText).toHaveBeenCalledOnce();
  });

  it('emits speak when the speech button is clicked', () => {
    fixture.componentRef.setInput('showSpeech', true);
    fixture.detectChanges();
    let emitted = false;
    fixture.componentInstance.speak.subscribe(() => (emitted = true));
    const btn = fixture.nativeElement.querySelector(
      'button[aria-label="Announce next departure"]',
    ) as HTMLButtonElement;
    btn.click();
    expect(emitted).toBe(true);
  });

  it('disables the speech button when speechEnabled is false', () => {
    fixture.componentRef.setInput('showSpeech', true);
    fixture.componentRef.setInput('speechEnabled', false);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector(
      'button[aria-label="Announce next departure"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('reflects aria-pressed state from ThemeService', () => {
    mockTheme.isHighContrast.set(true);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector(
      'button[aria-label="High contrast"]',
    );
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});
