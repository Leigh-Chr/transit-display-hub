import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TableSkeletonComponent } from './table-skeleton.component';

describe('TableSkeletonComponent', () => {
  let component: TableSkeletonComponent;
  let fixture: ComponentFixture<TableSkeletonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TableSkeletonComponent],
    });
    fixture = TestBed.createComponent(TableSkeletonComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default rows=5', () => {
    expect(component.rows()).toBe(5);
  });

  it('should have 4 default columns', () => {
    expect(component.columns().length).toBe(4);
  });

  it('should generate rowsArray matching rows count', () => {
    expect(component.rowsArray).toEqual([0, 1, 2, 3, 4]);
  });

  it('should generate rowsArray for custom rows count', () => {
    fixture.componentRef.setInput('rows', 3);
    expect(component.rowsArray).toEqual([0, 1, 2]);
  });

  it('should render correct number of data rows', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const rows = fixture.nativeElement.querySelectorAll('.skeleton-row');
    expect(rows.length).toBe(5);
  });

  it('should render header row', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const header = fixture.nativeElement.querySelector('.skeleton-header');
    expect(header).toBeTruthy();
  });

  it('should accept custom columns config', async () => {
    fixture.componentRef.setInput('columns', [
      { width: '200px' },
      { width: '100px', height: '30px' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const headerSkeletons = fixture.nativeElement.querySelectorAll(
      '.skeleton-header app-skeleton',
    );
    expect(headerSkeletons.length).toBe(2);
  });
});
