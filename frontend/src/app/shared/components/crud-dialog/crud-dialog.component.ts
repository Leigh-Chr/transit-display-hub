import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Shell for every admin CRUD dialog (device, line, stop, schedule,
 * user, itinerary, message…). Owns the boilerplate that used to be
 * copied into nine files:
 *
 *   <h2 mat-dialog-title>…</h2>
 *   <mat-dialog-content>…the form…</mat-dialog-content>
 *   <mat-dialog-actions>
 *     <button cancel>…</button>
 *     <button submit + spinner>…</button>
 *   </mat-dialog-actions>
 *
 * The caller projects its own `<form>` and passes the validity /
 * submitting state in. Localised strings come from the caller too
 * so the shell stays Transloco-agnostic.
 */
@Component({
  selector: 'app-crud-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>
    <mat-dialog-content>
      <div class="form-container" [class.wide]="wide()">
        <ng-content />
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="submitting()">
        {{ cancelLabel() }}
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="submitDisabled() || submitting()"
        (click)="submitted.emit()"
      >
        @if (submitting()) {
          <mat-progress-spinner mode="indeterminate" diameter="18" />
        }
        {{ submitLabel() }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: var(--app-dialog-min-width);
      padding-top: 8px;
    }

    .form-container.wide {
      min-width: var(--app-dialog-min-width-lg);
    }
  `,
})
export class CrudDialogComponent {
  readonly title = input.required<string>();
  readonly submitLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  readonly submitting = input(false);
  readonly submitDisabled = input(false);
  /** Switch to the larger min-width used by dialogs with side-by-side
   *  fields (messages dialog grid, future composite forms). */
  readonly wide = input(false);

  readonly submitted = output();
}
