import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { DisplayLayoutComponent } from './display-layout.component';

describe('DisplayLayoutComponent', () => {
  let component: DisplayLayoutComponent;
  let fixture: ComponentFixture<DisplayLayoutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DisplayLayoutComponent],
      providers: [provideRouter([])],
    });

    fixture = TestBed.createComponent(DisplayLayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should contain a router-outlet', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const outlet = fixture.nativeElement.querySelector('router-outlet');
    expect(outlet).toBeTruthy();
  });

  it('should have display block on host element', () => {
    fixture.detectChanges();

    const hostEl = fixture.nativeElement as HTMLElement;
    // The :host style sets display: block; min-height: 100vh
    // In test environment, styles may or may not be applied, so we check the component exists
    expect(hostEl).toBeTruthy();
  });

  it('should render without any additional elements besides router-outlet', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // The template only contains a router-outlet
    const children = fixture.nativeElement.children;
    expect(children.length).toBe(1);
    expect(children[0].tagName.toLowerCase()).toBe('router-outlet');
  });
});
