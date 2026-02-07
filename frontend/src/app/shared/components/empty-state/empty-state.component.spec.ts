import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    });

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render default icon and title', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const iconEl = fixture.nativeElement.querySelector('.empty-icon mat-icon');
    expect(iconEl.textContent.trim()).toBe('inbox');

    const titleEl = fixture.nativeElement.querySelector('.empty-title');
    expect(titleEl.textContent.trim()).toBe('No items found');
  });

  it('should render custom icon and title', async () => {
    fixture.componentRef.setInput('icon', 'search');
    fixture.componentRef.setInput('title', 'No results');
    fixture.detectChanges();
    await fixture.whenStable();

    const iconEl = fixture.nativeElement.querySelector('.empty-icon mat-icon');
    expect(iconEl.textContent.trim()).toBe('search');

    const titleEl = fixture.nativeElement.querySelector('.empty-title');
    expect(titleEl.textContent.trim()).toBe('No results');
  });

  it('should not render description when not provided', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const descEl = fixture.nativeElement.querySelector('.empty-description');
    expect(descEl).toBeFalsy();
  });

  it('should render description when provided', async () => {
    fixture.componentRef.setInput('description', 'Try adjusting your filters');
    fixture.detectChanges();
    await fixture.whenStable();

    const descEl = fixture.nativeElement.querySelector('.empty-description');
    expect(descEl).toBeTruthy();
    expect(descEl.textContent.trim()).toBe('Try adjusting your filters');
  });

  it('should not render action button when actionLabel is not provided', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('button[mat-flat-button]');
    expect(button).toBeFalsy();
  });

  it('should render action button when actionLabel is provided', async () => {
    fixture.componentRef.setInput('actionLabel', 'Add Item');
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('button[mat-flat-button]');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Add Item');
  });

  it('should emit action event when button is clicked', async () => {
    fixture.componentRef.setInput('actionLabel', 'Create');
    fixture.detectChanges();
    await fixture.whenStable();

    let emitted = false;
    component.action.subscribe(() => {
      emitted = true;
    });

    const button = fixture.nativeElement.querySelector('button[mat-flat-button]');
    button.click();

    expect(emitted).toBe(true);
  });

  it('should render action icon when provided alongside actionLabel', async () => {
    fixture.componentRef.setInput('actionLabel', 'Create');
    fixture.componentRef.setInput('actionIcon', 'add');
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('button[mat-flat-button]');
    const icon = button.querySelector('mat-icon');
    expect(icon).toBeTruthy();
    expect(icon.textContent.trim()).toBe('add');
  });

  it('should apply primary class to icon container when iconColor is primary', async () => {
    fixture.componentRef.setInput('iconColor', 'primary');
    fixture.detectChanges();
    await fixture.whenStable();

    const iconContainer = fixture.nativeElement.querySelector('.empty-icon');
    expect(iconContainer.classList.contains('primary')).toBe(true);
  });

  it('should apply default class to icon container by default', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const iconContainer = fixture.nativeElement.querySelector('.empty-icon');
    expect(iconContainer.classList.contains('default')).toBe(true);
  });
});
