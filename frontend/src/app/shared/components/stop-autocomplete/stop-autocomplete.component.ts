import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

const MAX_RESULTS = 30;

/**
 * Minimal contract the autocomplete needs from a stop-like row. Any
 * concrete model that carries an id + a human-readable name fits — both
 * the admin `Stop` and the network-map `LayoutStop` satisfy it without
 * mapping. `platformCode` is opt-in: only the call sites that toggle
 * `showPlatformCode` need to supply it.
 */
export interface StopAutocompleteOption {
  readonly id: string;
  readonly name: string;
  readonly platformCode?: string | null;
}

/**
 * Reusable stop picker with a debounce-free filter over an already-loaded
 * stop list. Four call sites (`pathways`, `fare-calculator` origin +
 * dest, `route-search-bar` departure + arrival) used to inline the same
 * `[(ngModel)]+filter→slice(0, 30)+mat-autocomplete` block.
 *
 * The component does NOT fetch the stop list itself — callers feed it via
 * the `stops` input. This keeps the data ownership and error handling in
 * the page (some pages also wire a `loadError` overlay around the same
 * fetch) and avoids spawning N copies of the `getAll()` call when several
 * fields appear on the same page.
 */
@Component({
  selector: 'app-stop-autocomplete',
  standalone: true,
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field appearance="outline" class="stop-autocomplete">
      <mat-label>{{ label() }}</mat-label>
      <input
        type="text"
        matInput
        [ngModel]="searchText()"
        (ngModelChange)="onTyped($event)"
        [matAutocomplete]="auto"
        [placeholder]="placeholder() ?? ''" />
      <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onPick($event)">
        @for (s of filtered(); track s.id) {
          <mat-option [value]="s">
            {{ s.name }}
            @if (showPlatformCode() && s.platformCode) {
              <span class="platform">·&nbsp;{{ s.platformCode }}</span>
            }
          </mat-option>
        }
      </mat-autocomplete>
      <mat-icon matSuffix>place</mat-icon>
    </mat-form-field>
  `,
  styles: `
    .stop-autocomplete {
      width: 100%;
    }
    .platform {
      color: var(--mat-sys-on-surface-variant);
      font-size: var(--m3-type-body-small);
      margin-left: 6px;
    }
  `,
})
export class StopAutocompleteComponent {
  readonly stops = input.required<readonly StopAutocompleteOption[]>();
  readonly label = input.required<string>();
  readonly placeholder = input<string | null>(null);
  readonly showPlatformCode = input<boolean>(false);
  /** Pre-fill the search text without firing `selected`. Used by
   *  callers that own the selection state and want the field to mirror
   *  it (e.g. {@code route-search-bar}'s map-click sync). */
  readonly value = input<StopAutocompleteOption | null>(null);
  readonly selected = output<StopAutocompleteOption>();

  private readonly query = signal('');
  protected readonly searchText = computed(() => this.query());

  constructor() {
    // Mirror an externally pushed `value` into the text query so a
    // parent that owns the selection (e.g. a swap button) can keep
    // the field label in sync without re-emitting `selected`.
    effect(() => {
      const external = this.value();
      this.query.set(external?.name ?? '');
    });
  }

  protected readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    const all = this.stops();
    if (!q) {
      return all.slice(0, MAX_RESULTS);
    }
    return all.filter(s => s.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
  });

  protected onTyped(value: string | StopAutocompleteOption): void {
    if (typeof value === 'object') {
      // Material autocomplete passes the selected object through
      // ngModel after an `optionSelected` event. Ignore those —
      // `onPick` already handled the selection and updated the text.
      return;
    }
    this.query.set(value);
  }

  protected onPick(event: MatAutocompleteSelectedEvent): void {
    const stop = event.option.value as StopAutocompleteOption;
    this.query.set(stop.name);
    this.selected.emit(stop);
  }
}
