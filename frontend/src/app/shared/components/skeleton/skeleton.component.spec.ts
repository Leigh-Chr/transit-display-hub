import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SkeletonComponent } from './skeleton.component';

describe('SkeletonComponent', () => {
  let component: SkeletonComponent;
  let fixture: ComponentFixture<SkeletonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SkeletonComponent],
    });
    fixture = TestBed.createComponent(SkeletonComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default inputs', () => {
    expect(component.width()).toBe('100%');
    expect(component.height()).toBe('20px');
    expect(component.borderRadius()).toBe('4px');
    expect(component.variant()).toBe('rect');
  });

  it('should apply skeleton-circle class when variant is circle', async () => {
    fixture.componentRef.setInput('variant', 'circle');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement.querySelector('.skeleton');
    expect(el.classList.contains('skeleton-circle')).toBe(true);
  });

  it('should apply skeleton-text class when variant is text', async () => {
    fixture.componentRef.setInput('variant', 'text');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement.querySelector('.skeleton');
    expect(el.classList.contains('skeleton-text')).toBe(true);
  });

  it('should not apply variant classes for rect variant', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement.querySelector('.skeleton');
    expect(el.classList.contains('skeleton-circle')).toBe(false);
    expect(el.classList.contains('skeleton-text')).toBe(false);
  });

  it('should set custom width, height, and borderRadius via inputs', async () => {
    fixture.componentRef.setInput('width', '200px');
    fixture.componentRef.setInput('height', '50px');
    fixture.componentRef.setInput('borderRadius', '12px');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement.querySelector('.skeleton') as HTMLElement;
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('50px');
    expect(el.style.borderRadius).toBe('12px');
  });
});
