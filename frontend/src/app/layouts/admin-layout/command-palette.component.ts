import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';

interface PaletteEntry {
  /** i18n key for the visible label */
  labelKey: string;
  icon: string;
  route: string;
  /** Restricts the entry to admin-only when true. */
  adminOnly: boolean;
}

const ENTRIES: PaletteEntry[] = [
  { labelKey: 'admin.navigation.dashboard',   icon: 'dashboard',     route: '/admin/dashboard',                adminOnly: false },
  { labelKey: 'admin.navigation.messages',    icon: 'campaign',      route: '/admin/messages',                 adminOnly: false },
  { labelKey: 'admin.navigation.networkMap',  icon: 'map',           route: '/map',                            adminOnly: false },
  { labelKey: 'admin.navigation.lines',       icon: 'subway',        route: '/admin/lines',                    adminOnly: true  },
  { labelKey: 'admin.navigation.stops',       icon: 'place',         route: '/admin/stops',                    adminOnly: true  },
  { labelKey: 'admin.navigation.itineraries', icon: 'route',         route: '/admin/itineraries',              adminOnly: true  },
  { labelKey: 'admin.navigation.schedules',   icon: 'schedule',      route: '/admin/schedules',                adminOnly: true  },
  { labelKey: 'admin.navigation.devices',     icon: 'tv',            route: '/admin/devices',                  adminOnly: true  },
  { labelKey: 'admin.navigation.realtime',    icon: 'sensors',       route: '/admin/operations/realtime',      adminOnly: true  },
  { labelKey: 'admin.navigation.importAudit', icon: 'history',       route: '/admin/operations/import-history',adminOnly: true  },
  { labelKey: 'admin.navigation.users',       icon: 'people',        route: '/admin/users',                    adminOnly: true  },
];

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <div class="palette-input-wrap">
        <mat-icon class="palette-input-icon" aria-hidden="true">search</mat-icon>
        <input
          #queryInput
          matInput
          type="text"
          class="palette-input"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
          (keydown.enter)="activateFirst()"
          [placeholder]="t('admin.commandPalette.placeholder')"
          [attr.aria-label]="t('admin.commandPalette.placeholder')"
          autocomplete="off"
        />
      </div>
      <ul class="palette-list" role="listbox">
        @for (entry of filtered(); track entry.route) {
          <li>
            <button
              type="button"
              role="option"
              class="palette-row"
              (click)="navigate(entry.route)"
            >
              <mat-icon aria-hidden="true">{{ entry.icon }}</mat-icon>
              <span class="palette-label">{{ t(entry.labelKey) }}</span>
              <span class="palette-route">{{ entry.route }}</span>
            </button>
          </li>
        } @empty {
          <li class="palette-empty">{{ t('admin.commandPalette.noMatch') }}</li>
        }
      </ul>
    </ng-container>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .palette-input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--app-outline-variant);
    }
    .palette-input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--app-on-surface);
      font-size: var(--m3-type-body-large);
    }
    .palette-input-icon {
      color: var(--app-on-surface-variant);
    }
    .palette-list {
      list-style: none;
      padding: 4px 0;
      margin: 0;
      max-height: 320px;
      overflow-y: auto;
    }
    .palette-row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 16px;
      border: 0;
      background: transparent;
      cursor: pointer;
      color: var(--app-on-surface);
      text-align: left;
      font: inherit;
    }
    .palette-row:hover,
    .palette-row:focus-visible {
      background: var(--app-surface-container-high);
      outline: 0;
    }
    .palette-label {
      flex: 1;
      font-weight: 500;
    }
    .palette-route {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: var(--m3-type-label-small);
      color: var(--app-on-surface-variant);
    }
    .palette-empty {
      padding: 24px;
      text-align: center;
      color: var(--app-on-surface-variant);
      font-size: var(--m3-type-body-medium);
    }
  `,
})
export class CommandPaletteComponent {
  private readonly dialogRef = inject(MatDialogRef<CommandPaletteComponent>);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly query = signal('');

  readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    const isAdmin = this.authService.isAdmin();
    return ENTRIES.filter((e) => isAdmin || !e.adminOnly).filter((e) => {
      if (!q) {return true;}
      return e.labelKey.toLowerCase().includes(q) || e.route.includes(q);
    });
  });

  activateFirst(): void {
    const first = this.filtered()[0];
    if (first) {
      this.navigate(first.route);
    }
  }

  navigate(route: string): void {
    void this.router.navigateByUrl(route);
    this.dialogRef.close();
  }
}
