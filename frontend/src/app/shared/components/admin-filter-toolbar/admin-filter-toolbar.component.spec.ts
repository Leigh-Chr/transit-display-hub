import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { AdminFilterToolbarComponent } from './admin-filter-toolbar.component';

describe('AdminFilterToolbarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminFilterToolbarComponent] });
  });

  it('projects children inside the toolbar wrapper', async () => {
    @Component({
      standalone: true,
      imports: [AdminFilterToolbarComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <app-admin-filter-toolbar>
          <button class="search">go</button>
          <select class="filter"></select>
        </app-admin-filter-toolbar>
      `,
    })
    class HostComponent {}

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const toolbar = fixture.nativeElement.querySelector('.toolbar');
    expect(toolbar.querySelector('.search')).toBeTruthy();
    expect(toolbar.querySelector('.filter')).toBeTruthy();
  });
});
