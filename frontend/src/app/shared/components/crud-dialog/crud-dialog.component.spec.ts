import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { describe, it, expect, beforeEach } from 'vitest';
import { CrudDialogComponent } from './crud-dialog.component';

@Component({
  standalone: true,
  imports: [CrudDialogComponent, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-crud-dialog
      title="Create"
      submitLabel="Save"
      cancelLabel="Cancel"
      [submitDisabled]="disabled"
      [submitting]="submitting"
      (submitted)="onSubmit()"
    >
      <p class="payload">field</p>
    </app-crud-dialog>
  `,
})
class HostComponent {
  disabled = false;
  submitting = false;
  submitted = 0;
  onSubmit(): void {
    this.submitted++;
  }
}

describe('CrudDialogComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('renders title, action labels and projected content', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Create');
    expect(text).toContain('Save');
    expect(text).toContain('Cancel');
    expect(fixture.nativeElement.querySelector('.payload')?.textContent.trim()).toBe('field');
  });

  it('emits submit when the primary button is clicked', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    // [0] = cancel (mat-dialog-close), [1] = submit
    (buttons[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.submitted).toBe(1);
  });

  it('disables both buttons while submitting', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.submitting = true;
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
  });
});
