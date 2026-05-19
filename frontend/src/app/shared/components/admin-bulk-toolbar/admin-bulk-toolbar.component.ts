import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';

/**
 * Page-level bulk selection bar. Drives the "select all visible" checkbox
 * and the cancel/delete cluster that appears once at least one row is
 * selected. The label inputs receive already-localised strings (with the
 * count interpolated by the caller's Transloco template), so this
 * component stays Transloco-agnostic.
 */
@Component({
  selector: 'app-admin-bulk-toolbar',
  standalone: true,
  imports: [MatButtonModule, MatCheckboxModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bulk-toolbar">
      <mat-checkbox
        [checked]="allCurrentSelected()"
        [indeterminate]="someCurrentSelected()"
        (change)="selectAllToggle.emit($event.checked)"
      >
        {{ selectAllLabel() }}
      </mat-checkbox>
      @if (selectionCount() > 0) {
        <span class="bulk-count">{{ selectedCountLabel() }}</span>
        <button mat-button type="button" (click)="clearSelection.emit()">
          {{ cancelLabel() }}
        </button>
        <button mat-flat-button color="warn" type="button" (click)="bulkDelete.emit()">
          <mat-icon aria-hidden="true">delete</mat-icon>
          {{ bulkDeleteLabel() }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .bulk-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0 0 16px;
      padding: 8px 12px;
      border-radius: var(--app-radius-sm);
      background: var(--app-surface-container);
      flex-wrap: wrap;
    }

    .bulk-count {
      font-weight: 600;
      color: var(--app-primary);
      margin-right: auto;
    }
  `,
})
export class AdminBulkToolbarComponent {
  readonly allCurrentSelected = input.required<boolean>();
  readonly someCurrentSelected = input.required<boolean>();
  readonly selectionCount = input.required<number>();
  readonly selectAllLabel = input.required<string>();
  readonly selectedCountLabel = input.required<string>();
  readonly bulkDeleteLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();

  readonly selectAllToggle = output<boolean>();
  readonly clearSelection = output();
  readonly bulkDelete = output();
}
