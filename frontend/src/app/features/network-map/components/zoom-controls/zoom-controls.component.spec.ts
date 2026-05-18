import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testTranslocoModule } from '../../../../../test-translations';
import { ZoomControlsComponent } from './zoom-controls.component';

const zoomDict = { map: { zoom: { in: 'Zoom in', out: 'Zoom out', reset: 'Reset view' } } };

describe('ZoomControlsComponent', () => {
  let fixture: ComponentFixture<ZoomControlsComponent>;
  let component: ZoomControlsComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        ZoomControlsComponent,
        testTranslocoModule(zoomDict),
      ],
    });
    fixture = TestBed.createComponent(ZoomControlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function clickButton(title: string): void {
    const btn = fixture.nativeElement.querySelector(`button[title="${title}"]`) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
  }

  it('renders three control buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button.zoom-btn');
    expect(buttons.length).toBe(3);
  });

  it('emits zoomIn when the + button is clicked', () => {
    const spy = vi.fn();
    component.zoomIn.subscribe(spy);
    clickButton('Zoom in');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits zoomOut when the − button is clicked', () => {
    const spy = vi.fn();
    component.zoomOut.subscribe(spy);
    clickButton('Zoom out');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits resetView when the fit button is clicked', () => {
    const spy = vi.fn();
    component.resetView.subscribe(spy);
    clickButton('Reset view');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
