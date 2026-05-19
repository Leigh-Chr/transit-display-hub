import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { LineBadgeComponent } from './line-badge.component';

describe('LineBadgeComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LineBadgeComponent] });
  });

  it('renders the code and applies the GTFS colour', async () => {
    const fixture = TestBed.createComponent(LineBadgeComponent);
    fixture.componentRef.setInput('code', 'A');
    fixture.componentRef.setInput('color', '#ff0000');
    fixture.detectChanges();
    await fixture.whenStable();

    const span = fixture.nativeElement.querySelector('.line-badge');
    expect(span.textContent.trim()).toBe('A');
    expect(span.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('applies sm/lg classes when size differs from md', async () => {
    const fixture = TestBed.createComponent(LineBadgeComponent);
    fixture.componentRef.setInput('code', '1');
    fixture.componentRef.setInput('color', '#0000ff');
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.line-badge').classList.contains('lg')).toBe(true);
  });
});
