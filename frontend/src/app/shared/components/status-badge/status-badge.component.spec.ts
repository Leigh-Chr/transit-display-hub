import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StatusBadgeComponent] });
  });

  it('projects content and applies the neutral tone class by default', async () => {
    @Component({
      standalone: true,
      imports: [StatusBadgeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<app-status-badge>Pending</app-status-badge>`,
    })
    class HostComponent {}

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const badge = fixture.nativeElement.querySelector('.status-badge');
    expect(badge.textContent.trim()).toBe('Pending');
    expect(badge.classList.contains('tone-neutral')).toBe(true);
  });

  it('applies the requested tone, size, and uppercase modifiers', async () => {
    @Component({
      standalone: true,
      imports: [StatusBadgeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<app-status-badge tone="critical" size="sm" [uppercase]="true">Off</app-status-badge>`,
    })
    class HostComponent {}

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const badge = fixture.nativeElement.querySelector('.status-badge');
    expect(badge.classList.contains('tone-critical')).toBe(true);
    expect(badge.classList.contains('size-sm')).toBe(true);
    expect(badge.classList.contains('uppercase')).toBe(true);
  });
});
