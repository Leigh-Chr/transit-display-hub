import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SeverityIconComponent } from './severity-icon.component';

describe('SeverityIconComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SeverityIconComponent] });
  });

  it('renders the critical icon and tone for CRITICAL severity', async () => {
    const fixture = TestBed.createComponent(SeverityIconComponent);
    fixture.componentRef.setInput('severity', 'CRITICAL');
    fixture.detectChanges();
    await fixture.whenStable();

    const icon = fixture.nativeElement.querySelector('.severity-icon');
    expect(icon.classList.contains('tone-critical')).toBe(true);
    expect(icon.querySelector('mat-icon').textContent.trim()).toBe('error');
  });

  it('maps WARNING + INFO severities to their respective icons and tones', async () => {
    const fixture = TestBed.createComponent(SeverityIconComponent);

    fixture.componentRef.setInput('severity', 'WARNING');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.severity-icon').classList.contains('tone-warning')).toBe(true);
    expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('warning');

    fixture.componentRef.setInput('severity', 'INFO');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.severity-icon').classList.contains('tone-info')).toBe(true);
    expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('info');
  });

  it('applies the size-sm modifier when size is "sm"', async () => {
    const fixture = TestBed.createComponent(SeverityIconComponent);
    fixture.componentRef.setInput('severity', 'INFO');
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.severity-icon').classList.contains('size-sm')).toBe(true);
  });
});
