import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Wraps the search + filter row that sits above every admin list
 * (lines, stops, itineraries, messages, users…). The previous mixin
 * (`admin.crud-toolbar`) only carried styles; this component carries
 * the markup too so the wrapping element stops being copy-pasted.
 *
 * Slot order is the caller's choice — children render in whatever
 * order they appear in the template, with the standard flex/gap/wrap
 * applied uniformly.
 */
@Component({
  selector: 'app-admin-filter-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="toolbar"><ng-content /></div>`,
  styles: `
    :host {
      display: block;
    }

    .toolbar {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      align-items: center;
    }

    @media (max-width: 600px) {
      .toolbar {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `,
})
export class AdminFilterToolbarComponent {}
