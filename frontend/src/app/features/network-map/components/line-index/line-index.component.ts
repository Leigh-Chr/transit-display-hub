import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective } from '@jsverse/transloco';
import { NetworkLine } from '@shared/models';

/**
 * Grid of line cards used as a fallback when too many lines would be empty
 * stacked rows on the schematic map. The user picks a line to focus on it.
 */
@Component({
  selector: 'app-line-index',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="index-wrapper" *transloco="let t; read: 'map.lineIndex'">
      <div class="index-header">
        <div class="search-field">
          <mat-icon>search</mat-icon>
          <input
            type="text"
            [placeholder]="t('searchPlaceholder')"
            [formControl]="searchCtrl"
            autocomplete="off"
          />
          @if (searchCtrl.value) {
            <button
              type="button"
              class="clear-btn"
              (click)="searchCtrl.setValue('')"
              [attr.aria-label]="t('clearAria')"
            >
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>
        <div class="header-summary">
          <span class="summary-count">{{ filteredLines().length }}</span>
          <span class="summary-label">{{
            filteredLines().length === lines().length
              ? t('summaryLinesAll')
              : t('summaryLinesMatching')
          }}</span>
        </div>
      </div>

      <p class="hint">
        <mat-icon class="hint-icon">touch_app</mat-icon>
        {{ t('subtitle') }}
      </p>

      <div class="index-grid" role="list">
        @for (line of filteredLines(); track line.id) {
          <button
            type="button"
            role="listitem"
            class="line-card"
            (click)="lineSelected.emit(line.code)"
          >
            <span class="line-badge" [style.background]="line.color">{{ line.code }}</span>
            <span class="line-text">
              <span class="line-name">{{ line.name }}</span>
              @if (line.category) {
                <span class="line-category">{{ line.category }}</span>
              }
            </span>
            <mat-icon class="line-arrow">chevron_right</mat-icon>
          </button>
        }
        @if (filteredLines().length === 0) {
          <div class="empty-state">
            <mat-icon>search_off</mat-icon>
            <span>{{ t('emptyState', { query: searchCtrl.value }) }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      background: var(--app-map-surface-container, var(--app-map-overlay-bg));
    }

    .index-wrapper {
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 16px 20px 20px;
      box-sizing: border-box;
      overflow: hidden;
    }

    /* The route/stop search overlay floats top-right of the map wrapper.
       Reserve room for it on wide screens so its panels never sit on top
       of the line cards. On narrow viewports the overlay gracefully
       overlaps the first cards instead — they remain reachable by scroll. */
    @media (min-width: 900px) {
      .index-wrapper {
        padding-right: 270px;
      }
    }

    .index-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
    }

    .search-field {
      flex: 1;
      max-width: 480px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--app-map-input-bg, var(--app-map-overlay-bg));
      border: 1px solid var(--app-map-outline);
      border-radius: var(--app-radius-md);
      transition: border-color 120ms ease;
    }

    .search-field:focus-within {
      border-color: var(--app-map-accent);
    }

    .search-field mat-icon {
      flex-shrink: 0;
      font-size: var(--m3-type-title-large);
      width: 18px;
      height: 18px;
      color: var(--app-map-on-surface-variant);
    }

    .search-field input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      color: var(--app-map-on-surface);
      font-size: var(--m3-type-body-medium);
    }

    .search-field input::placeholder {
      color: var(--app-map-on-surface-muted);
    }

    .clear-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: var(--app-map-surface-container-high);
      color: var(--app-map-on-surface-variant);
      cursor: pointer;
    }

    .clear-btn mat-icon {
      font-size: var(--m3-type-body-medium);
      width: 14px;
      height: 14px;
    }

    .header-summary {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      color: var(--app-map-on-surface-variant);
      font-size: var(--m3-type-body-medium);
    }

    .summary-count {
      font-size: var(--m3-type-title-large);
      font-weight: 700;
      color: var(--app-map-on-surface);
    }

    .hint {
      flex-shrink: 0;
      margin: 0 0 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--app-map-on-surface-muted);
      font-size: var(--m3-type-body-small);
    }

    .hint-icon {
      font-size: var(--m3-type-body-large);
      width: 16px;
      height: 16px;
    }

    .index-grid {
      flex: 1;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      grid-auto-rows: max-content;
      gap: 8px;
      padding-right: 4px;
      align-content: start;
    }

    .line-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid var(--app-map-outline);
      border-radius: var(--app-radius-md);
      background: var(--app-map-surface);
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      min-width: 0;
    }

    .line-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px var(--app-map-shadow);
      border-color: var(--app-map-accent);
    }

    .line-card:active {
      transform: translateY(0);
    }

    .line-badge {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 28px;
      padding: 0 8px;
      border-radius: 14px;
      color: #fff;
      font-size: var(--m3-type-body-small);
      font-weight: 700;
      letter-spacing: 0.02em;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
    }

    .line-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .line-name {
      font-size: var(--m3-type-body-medium);
      font-weight: 600;
      color: var(--app-map-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .line-category {
      font-size: var(--m3-type-label-small);
      font-weight: 600;
      color: var(--app-map-on-surface-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .line-arrow {
      flex-shrink: 0;
      font-size: var(--m3-type-title-large);
      width: 18px;
      height: 18px;
      color: var(--app-map-on-surface-muted);
    }

    .empty-state {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 60px 20px;
      color: var(--app-map-on-surface-muted);
      font-size: var(--m3-type-body-medium);
      text-align: center;
    }

    .empty-state mat-icon {
      // mat-icon font-size is glyph height; matches its container box.
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.5;
    }
  `
})
export class LineIndexComponent {
  readonly lines = input.required<readonly NetworkLine[]>();
  readonly lineSelected = output<string>();

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  private readonly searchSignal = toSignal(this.searchCtrl.valueChanges, { initialValue: '' });

  readonly filteredLines = computed(() => {
    const term = this.searchSignal().toLowerCase().trim();
    const all = this.lines();
    if (!term) {return all;}
    return all.filter(l =>
      l.code.toLowerCase().includes(term) ||
      l.name.toLowerCase().includes(term) ||
      (l.category ?? '').toLowerCase().includes(term)
    );
  });
}
