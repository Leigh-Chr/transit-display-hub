import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { AdminPageHeaderComponent } from './admin-page-header.component';

describe('AdminPageHeaderComponent', () => {
  let fixture: ComponentFixture<AdminPageHeaderComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminPageHeaderComponent] });
    fixture = TestBed.createComponent(AdminPageHeaderComponent);
    fixture.componentRef.setInput('title', 'Devices');
  });

  it('renders the provided title', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const titleEl = fixture.nativeElement.querySelector('.page-title');
    expect(titleEl.textContent.trim()).toBe('Devices');
  });

  it('does not render subtitle when none is provided', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.page-subtitle')).toBeFalsy();
  });

  it('renders subtitle when provided', async () => {
    fixture.componentRef.setInput('subtitle', 'Manage kiosks');
    fixture.detectChanges();
    await fixture.whenStable();
    const sub = fixture.nativeElement.querySelector('.page-subtitle');
    expect(sub.textContent.trim()).toBe('Manage kiosks');
  });

  it('projects content into the actions slot', async () => {
    @Component({
      standalone: true,
      imports: [AdminPageHeaderComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <app-admin-page-header title="T">
          <button actions class="my-action">Add</button>
        </app-admin-page-header>
      `,
    })
    class HostComponent {}

    const hostFixture = TestBed.createComponent(HostComponent);
    hostFixture.detectChanges();
    await hostFixture.whenStable();

    const projected = hostFixture.nativeElement.querySelector('.page-actions .my-action');
    expect(projected).toBeTruthy();
    expect(projected.textContent.trim()).toBe('Add');
  });
});
