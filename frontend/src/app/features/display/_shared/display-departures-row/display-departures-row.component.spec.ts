import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { LineInfo } from '@shared/models';

import { DisplayDeparturesRowComponent } from './display-departures-row.component';
import { testTranslocoModule } from '../../../../../test-translations';

const TRANSLATIONS = {
  kiosk: {
    imminent: 'Imminent',
    minutesShort: '{{ minutes }} min',
    booking: {
      label: 'Reservation',
      aria: 'Reservation required',
      minMinutes: '≥ {{ minutes }} min',
    },
  },
};

const LINE: LineInfo = {
  id: 'L1',
  code: 'A',
  name: 'Line A',
  color: '#ff0000',
  textColor: '#ffffff',
};

describe('DisplayDeparturesRowComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DisplayDeparturesRowComponent, testTranslocoModule(TRANSLATIONS)],
    });
  });

  it('renders the line code, relative ETA, and absolute time', () => {
    const fixture = TestBed.createComponent(DisplayDeparturesRowComponent);
    fixture.componentRef.setInput('line', LINE);
    fixture.componentRef.setInput('time', '22:05');
    fixture.componentRef.setInput('now', new Date('2026-05-17T22:00:00'));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('A');
    expect(text).toMatch(/5\s*min/);
    expect(text).toContain('22:05');
  });

  it('shows the imminent badge when the ETA is under a minute', () => {
    const fixture = TestBed.createComponent(DisplayDeparturesRowComponent);
    fixture.componentRef.setInput('line', LINE);
    fixture.componentRef.setInput('time', '22:00');
    fixture.componentRef.setInput('now', new Date('2026-05-17T22:00:30'));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Imminent');
    const relative = (fixture.nativeElement as HTMLElement).querySelector('.time-relative');
    expect(relative?.classList.contains('imminent')).toBe(true);
  });

  it('renders the platform column when provided', () => {
    const fixture = TestBed.createComponent(DisplayDeparturesRowComponent);
    fixture.componentRef.setInput('line', LINE);
    fixture.componentRef.setInput('time', '22:05');
    fixture.componentRef.setInput('now', new Date('2026-05-17T22:00:00'));
    fixture.componentRef.setInput('platform', 'Quai 3');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Quai 3');
  });

  it('omits the platform column when null', () => {
    const fixture = TestBed.createComponent(DisplayDeparturesRowComponent);
    fixture.componentRef.setInput('line', LINE);
    fixture.componentRef.setInput('time', '22:05');
    fixture.componentRef.setInput('now', new Date('2026-05-17T22:00:00'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.platform')).toBeNull();
  });

  it('renders the booking CTA with an ARIA label when booking is provided', () => {
    const fixture = TestBed.createComponent(DisplayDeparturesRowComponent);
    fixture.componentRef.setInput('line', LINE);
    fixture.componentRef.setInput('time', '22:10');
    fixture.componentRef.setInput('now', new Date('2026-05-17T22:00:00'));
    fixture.componentRef.setInput('booking', { phone: '0123456789', priorNoticeMinutes: 30 });
    fixture.detectChanges();

    const badge = (fixture.nativeElement as HTMLElement).querySelector('.booking-badge');
    expect(badge).toBeTruthy();
    expect(badge?.getAttribute('aria-label')).toContain('Reservation required');
    expect(badge?.getAttribute('aria-label')).toContain('0123456789');
  });

  it('does not render the booking CTA when booking is null', () => {
    const fixture = TestBed.createComponent(DisplayDeparturesRowComponent);
    fixture.componentRef.setInput('line', LINE);
    fixture.componentRef.setInput('time', '22:10');
    fixture.componentRef.setInput('now', new Date('2026-05-17T22:00:00'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.booking-badge')).toBeNull();
  });

  it('projects content into the destination slot', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Grand Place');
  });
});

@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [DisplayDeparturesRowComponent],
  template: `
    <app-display-departures-row
      [line]="line"
      [time]="'22:05'"
      [now]="now"
    >
      <span class="dest-text">Grand Place</span>
    </app-display-departures-row>
  `,
})
class HostComponent {
  readonly line = LINE;
  readonly now = new Date('2026-05-17T22:00:00');
}
