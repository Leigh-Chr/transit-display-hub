import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthCardComponent } from './auth-card.component';

describe('AuthCardComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AuthCardComponent] });
  });

  it('renders the title and falls back to no subtitle by default', async () => {
    const fixture = TestBed.createComponent(AuthCardComponent);
    fixture.componentRef.setInput('title', 'Sign in');
    fixture.componentRef.setInput('logoAlt', 'Logo');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.auth-title').textContent.trim()).toBe('Sign in');
    expect(fixture.nativeElement.querySelector('.auth-subtitle')).toBeFalsy();
  });

  it('renders subtitle when provided', async () => {
    const fixture = TestBed.createComponent(AuthCardComponent);
    fixture.componentRef.setInput('title', 'Update password');
    fixture.componentRef.setInput('subtitle', 'You must change it');
    fixture.componentRef.setInput('logoAlt', 'Logo');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.auth-subtitle').textContent.trim()).toBe('You must change it');
  });

  it('projects default and footer slots', async () => {
    @Component({
      standalone: true,
      imports: [AuthCardComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <app-auth-card title="T" logoAlt="alt">
          <p class="form-payload">form</p>
          <p footer class="footer-payload">hint</p>
        </app-auth-card>
      `,
    })
    class HostComponent {}

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.form-payload')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.footer-payload')).toBeTruthy();
  });
});
