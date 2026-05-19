import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope, TranslocoTestingModule } from '@jsverse/transloco';
import { describe, it, expect, beforeEach } from 'vitest';
import { DisplayConnectionWarningComponent } from './display-connection-warning.component';

function setupTestBed(): void {
  TestBed.configureTestingModule({
    imports: [
      DisplayConnectionWarningComponent,
      TranslocoTestingModule.forRoot({
        langs: {
          en: {
            kiosk: {
              connection: {
                reconnecting: 'Reconnecting',
                stale: 'Stale ({{ minutes }} min)',
              },
            },
          },
        },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [provideTranslocoScope('kiosk')],
  });
}

describe('DisplayConnectionWarningComponent', () => {
  beforeEach(setupTestBed);

  it('renders nothing when connected and not stale', async () => {
    const fixture = TestBed.createComponent(DisplayConnectionWarningComponent);
    fixture.componentRef.setInput('connected', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.connection-warning')).toBeFalsy();
  });

  it('shows the reconnecting pill when disconnected', async () => {
    const fixture = TestBed.createComponent(DisplayConnectionWarningComponent);
    fixture.componentRef.setInput('connected', false);
    fixture.detectChanges();
    await fixture.whenStable();

    const pill = fixture.nativeElement.querySelector('.connection-warning');
    expect(pill).toBeTruthy();
    expect(pill.classList.contains('stale-warning')).toBe(false);
  });

  it('shows the stale-warning variant when connected but data is stale', async () => {
    const fixture = TestBed.createComponent(DisplayConnectionWarningComponent);
    fixture.componentRef.setInput('connected', true);
    fixture.componentRef.setInput('isStale', true);
    fixture.componentRef.setInput('staleMinutes', 5);
    fixture.detectChanges();
    await fixture.whenStable();

    const pill = fixture.nativeElement.querySelector('.connection-warning');
    expect(pill).toBeTruthy();
    expect(pill.classList.contains('stale-warning')).toBe(true);
  });
});
