import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AlertOverlayComponent, VisibleLineAlert } from './alert-overlay.component';
import { AlertMessage, NetworkLine } from '@shared/models';

const alertDict = {
  map: {
    alertOverlay: {
      title: 'Active alerts',
      noAlerts: 'No active alerts',
      networkLabel: 'Network',
      linesLabel: 'Lines',
      lineLabel: 'Line {{ code }}',
      stopLabel: 'Stop {{ name }}',
    },
  },
};

describe('AlertOverlayComponent', () => {
  let fixture: ComponentFixture<AlertOverlayComponent>;
  let component: AlertOverlayComponent;

  const networkAlert: AlertMessage = { title: 'Snow', content: 'Service reduced', severity: 'WARNING' };
  const line: NetworkLine = {
    id: 'l1', code: 'A', name: 'Line A', color: '#FF0000', type: null, itineraries: [],
  };
  const lineAlert: AlertMessage = { title: 'Strike', content: 'Hour-long delays', severity: 'CRITICAL' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        AlertOverlayComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: alertDict, fr: alertDict },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    });
    fixture = TestBed.createComponent(AlertOverlayComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('networkAlerts', []);
    fixture.componentRef.setInput('lineAlerts', []);
  });

  it('renders nothing when there are no alerts', () => {
    fixture.detectChanges();

    expect(component.hasContent()).toBe(false);
    expect(fixture.nativeElement.querySelector('.alert-overlay')).toBeNull();
  });

  it('renders the network section when networkAlerts is non-empty', () => {
    fixture.componentRef.setInput('networkAlerts', [networkAlert]);
    fixture.detectChanges();

    expect(component.hasContent()).toBe(true);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.alert-section-label') as NodeListOf<Element>)
      .map(e => e.textContent.trim());
    expect(labels).toContain('Network');
    expect(labels).not.toContain('Lines');
  });

  it('renders the lines section with one panel per (line × alert) pair', () => {
    const entry: VisibleLineAlert = { line, alerts: [lineAlert, { ...lineAlert, title: 'Detour' }] };
    fixture.componentRef.setInput('lineAlerts', [entry]);
    fixture.detectChanges();

    const panels = fixture.nativeElement.querySelectorAll('mat-expansion-panel');
    expect(panels.length).toBe(2);

    const labels = Array.from(fixture.nativeElement.querySelectorAll('.alert-section-label') as NodeListOf<Element>)
      .map(e => e.textContent.trim());
    expect(labels).toContain('Lines');
  });

  it('renders both sections when network and line alerts are present', () => {
    fixture.componentRef.setInput('networkAlerts', [networkAlert]);
    fixture.componentRef.setInput('lineAlerts', [{ line, alerts: [lineAlert] }]);
    fixture.detectChanges();

    const labels = Array.from(fixture.nativeElement.querySelectorAll('.alert-section-label') as NodeListOf<Element>)
      .map(e => e.textContent.trim());
    expect(labels).toEqual(expect.arrayContaining(['Network', 'Lines']));
  });
});
