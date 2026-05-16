import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { testTranslocoModule } from '../../../../../test-translations';
import { MapLegendComponent } from './map-legend.component';

const legendDict = {
  map: {
    legend: {
      title: 'Legend',
      hide: 'Hide legend',
      show: 'Show legend',
      stop: 'Stop',
      terminus: 'Terminus',
      interchange: 'Interchange',
      tad: 'On-demand (TAD)',
      selected: 'Selected',
      wheelchair: 'Wheelchair accessible',
      hiddenLine: 'Hidden line',
      alert: 'Alert',
    },
  },
};

describe('MapLegendComponent', () => {
  let fixture: ComponentFixture<MapLegendComponent>;
  let component: MapLegendComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MapLegendComponent,
        testTranslocoModule(legendDict),
      ],
    });
    fixture = TestBed.createComponent(MapLegendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function legendItems(): NodeListOf<Element> {
    return fixture.nativeElement.querySelectorAll('.legend-item');
  }

  it('starts open with the three core legend items', () => {
    expect(component.open()).toBe(true);
    expect(legendItems().length).toBe(3); // Stop, Terminus, Interchange
  });

  it('hides items when collapsed via toggle()', () => {
    component.toggle();
    fixture.detectChanges();

    expect(component.open()).toBe(false);
    expect(legendItems().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.legend.collapsed')).toBeTruthy();
  });

  function legendLabels(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.legend-item span') as NodeListOf<Element>)
      .map(el => el.textContent.trim());
  }

  it('reveals the hidden-line entry only when hasHiddenLines is true', () => {
    expect(legendLabels()).not.toContain('Hidden line');

    fixture.componentRef.setInput('hasHiddenLines', true);
    fixture.detectChanges();

    expect(legendLabels()).toContain('Hidden line');
  });

  it('reveals the alert entry only when hasStopAlerts is true', () => {
    expect(legendLabels()).not.toContain('Alert');

    fixture.componentRef.setInput('hasStopAlerts', true);
    fixture.detectChanges();

    expect(legendLabels()).toContain('Alert');
  });

  it('toggle button announces correct expanded state for accessibility', () => {
    const button = fixture.nativeElement.querySelector('.legend-toggle') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('true');

    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Show legend');
  });
});
