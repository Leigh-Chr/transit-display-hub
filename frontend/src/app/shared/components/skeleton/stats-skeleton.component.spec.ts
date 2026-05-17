import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { StatsSkeletonComponent } from './stats-skeleton.component';

describe('StatsSkeletonComponent', () => {
  let fixture: ComponentFixture<StatsSkeletonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StatsSkeletonComponent],
    });
    fixture = TestBed.createComponent(StatsSkeletonComponent);
  });

  it('should render 3 stat cards', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const cards = fixture.nativeElement.querySelectorAll('.stat-card');
    expect(cards.length).toBe(3);
  });

  it('should render skeleton elements within each stat card', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const skeletons = fixture.nativeElement.querySelectorAll('app-skeleton');
    // Each card has 2 skeletons (value + label), 3 cards = 6 total
    expect(skeletons.length).toBe(6);
  });
});
