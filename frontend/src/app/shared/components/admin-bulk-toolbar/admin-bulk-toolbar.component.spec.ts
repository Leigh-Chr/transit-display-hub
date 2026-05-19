import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { AdminBulkToolbarComponent } from './admin-bulk-toolbar.component';

interface BaseInputs {
  allCurrentSelected: boolean;
  someCurrentSelected: boolean;
  selectionCount: number;
  selectAllLabel: string;
  selectedCountLabel: string;
  bulkDeleteLabel: string;
  cancelLabel: string;
}

const baseInputs: BaseInputs = {
  allCurrentSelected: false,
  someCurrentSelected: false,
  selectionCount: 0,
  selectAllLabel: 'Select all',
  selectedCountLabel: '3 selected',
  bulkDeleteLabel: 'Delete 3',
  cancelLabel: 'Cancel',
};

function setInputs(fixture: ReturnType<typeof TestBed.createComponent<AdminBulkToolbarComponent>>, overrides: Partial<BaseInputs> = {}): void {
  const merged: BaseInputs = { ...baseInputs, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fixture.componentRef.setInput(key, value);
  }
}

describe('AdminBulkToolbarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminBulkToolbarComponent] });
  });

  it('renders the select-all checkbox label even when selection is empty', async () => {
    const fixture = TestBed.createComponent(AdminBulkToolbarComponent);
    setInputs(fixture);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Select all');
    expect(fixture.nativeElement.querySelector('.bulk-count')).toBeFalsy();
  });

  it('exposes count + cancel + delete buttons when selection is non-empty', async () => {
    const fixture = TestBed.createComponent(AdminBulkToolbarComponent);
    setInputs(fixture, { selectionCount: 3, someCurrentSelected: true });
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('3 selected');
    expect(text).toContain('Cancel');
    expect(text).toContain('Delete 3');
  });

  it('emits selectAllToggle when the checkbox is toggled', async () => {
    const fixture = TestBed.createComponent(AdminBulkToolbarComponent);
    setInputs(fixture);
    fixture.detectChanges();
    await fixture.whenStable();

    let received: boolean | null = null;
    fixture.componentInstance.selectAllToggle.subscribe((checked) => {
      received = checked;
    });

    const input = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    input.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(received).toBe(true);
  });
});
