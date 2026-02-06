import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CardSkeletonComponent } from './card-skeleton.component';

describe('CardSkeletonComponent', () => {
  let component: CardSkeletonComponent;
  let fixture: ComponentFixture<CardSkeletonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CardSkeletonComponent],
    });
    fixture = TestBed.createComponent(CardSkeletonComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default showIcon to false', () => {
    expect(component.showIcon()).toBe(false);
  });

  it('should hide icon skeleton when showIcon is false (default)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const skeletons = fixture.nativeElement.querySelectorAll('app-skeleton');
    // Only the 2 content skeletons should be present (60% width and 40% width)
    expect(skeletons.length).toBe(2);
  });

  it('should show icon skeleton when showIcon is true', async () => {
    fixture.componentRef.setInput('showIcon', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const skeletons = fixture.nativeElement.querySelectorAll('app-skeleton');
    // 1 icon skeleton + 2 content skeletons = 3
    expect(skeletons.length).toBe(3);
  });
});
