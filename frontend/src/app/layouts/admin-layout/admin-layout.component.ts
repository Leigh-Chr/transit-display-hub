import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '@core/auth/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { BreakpointService } from '@core/services/breakpoint.service';
import { LineService } from '@core/api/line.service';
import {
  HubDisplayDialogComponent,
  HubDisplayDialogResult,
} from '@shared/components/hub-display-dialog/hub-display-dialog.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterModule,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <mat-sidenav-container class="admin-container">
      <mat-sidenav
        #sidenav
        [mode]="breakpointService.isSmallScreen() ? 'over' : 'side'"
        [opened]="sidenavOpen()"
        class="admin-sidenav"
        role="navigation"
        aria-label="Main navigation"
      >
        <div class="sidenav-header">
          <img src="assets/logo.png" alt="" class="sidenav-logo">
          <span class="brand-name">Transit Display Hub</span>
        </div>

        <mat-nav-list>
          <a
            mat-list-item
            routerLink="/admin/dashboard"
            routerLinkActive="active-link"
            (click)="closeSidenavOnMobile()"
          >
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>

          @if (authService.isAdmin()) {
            <mat-divider></mat-divider>
            <div class="nav-section-title">Network</div>

            <a
              mat-list-item
              routerLink="/admin/lines"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>subway</mat-icon>
              <span matListItemTitle>Lines</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/stops"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>place</mat-icon>
              <span matListItemTitle>Stops</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/itineraries"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>route</mat-icon>
              <span matListItemTitle>Itineraries</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/schedules"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>schedule</mat-icon>
              <span matListItemTitle>Schedules</span>
            </a>
          }

          <a
            mat-list-item
            routerLink="/map"
            routerLinkActive="active-link"
            (click)="closeSidenavOnMobile()"
          >
            <mat-icon matListItemIcon>map</mat-icon>
            <span matListItemTitle>Network Map</span>
          </a>

          @if (authService.isAdmin()) {
            <a
              mat-list-item
              (click)="openHubDisplay(); closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>hub</mat-icon>
              <span matListItemTitle>Hub Display</span>
            </a>
          }

          <mat-divider></mat-divider>
          <div class="nav-section-title">Communication</div>

          <a
            mat-list-item
            routerLink="/admin/messages"
            routerLinkActive="active-link"
            (click)="closeSidenavOnMobile()"
          >
            <mat-icon matListItemIcon>campaign</mat-icon>
            <span matListItemTitle>Messages</span>
          </a>

          @if (authService.isAdmin()) {
            <a
              mat-list-item
              routerLink="/admin/devices"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>tv</mat-icon>
              <span matListItemTitle>Devices</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/realtime"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>sensors</mat-icon>
              <span matListItemTitle>Temps réel</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/gtfs-data"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>dataset</mat-icon>
              <span matListItemTitle>Données GTFS</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/import-audit"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>history</mat-icon>
              <span matListItemTitle>Historique imports</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/pathways"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>alt_route</mat-icon>
              <span matListItemTitle>Pathways</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/shapes"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>polyline</mat-icon>
              <span matListItemTitle>Shapes</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/tad-zones"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>layers</mat-icon>
              <span matListItemTitle>Zones TAD</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/flex-stop-times"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>phone_callback</mat-icon>
              <span matListItemTitle>Stop_times TAD</span>
            </a>

            <a
              mat-list-item
              routerLink="/admin/fare-calculator"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>calculate</mat-icon>
              <span matListItemTitle>Calculateur tarifaire</span>
            </a>

            <mat-divider></mat-divider>
            <div class="nav-section-title">Administration</div>

            <a
              mat-list-item
              routerLink="/admin/users"
              routerLinkActive="active-link"
              (click)="closeSidenavOnMobile()"
            >
              <mat-icon matListItemIcon>people</mat-icon>
              <span matListItemTitle>Users</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary">
          <button
            mat-icon-button
            type="button"
            (click)="toggleSidenav()"
            aria-label="Toggle navigation menu"
            matTooltip="Toggle sidebar"
          >
            <mat-icon aria-hidden="true">{{ sidenavOpen() ? 'menu_open' : 'menu' }}</mat-icon>
          </button>
          <span class="toolbar-spacer"></span>
          <button
            mat-icon-button
            type="button"
            (click)="themeService.toggleTheme()"
            [matTooltip]="themeService.isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
            [attr.aria-label]="themeService.isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
            [attr.aria-pressed]="themeService.isDarkMode()"
          >
            <mat-icon aria-hidden="true">{{ themeService.isDarkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          @if (!breakpointService.isMobile()) {
            <span class="username">{{ authService.currentUser()?.username }}</span>
          }
          <button mat-button type="button" (click)="logout()" aria-label="Logout">
            <mat-icon aria-hidden="true">logout</mat-icon>
            @if (!breakpointService.isMobile()) {
              Logout
            }
          </button>
        </mat-toolbar>

        <main id="main-content" class="main-content" animate.enter="route-enter">
          <router-outlet></router-outlet>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .admin-container {
      height: 100vh;
    }

    .admin-sidenav {
      width: 260px;
    }

    .sidenav-header {
      padding: 24px 20px;
      border-bottom: 1px solid var(--app-sidebar-border);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sidenav-logo {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      filter: brightness(0) invert(1);
    }

    .sidenav-header .brand-name {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--app-sidebar-text);
      letter-spacing: -0.25px;
    }

    .skip-link {
      position: absolute;
      top: -100px;
      left: 8px;
      z-index: 1000;
      padding: 12px 16px;
      background: var(--mat-sys-primary, #0078D4);
      color: var(--mat-sys-on-primary, #ffffff);
      border-radius: var(--app-radius-sm);
      font-weight: 600;
      text-decoration: none;
    }

    .skip-link:focus {
      top: 8px;
      outline: 2px solid var(--mat-sys-on-primary, #ffffff);
      outline-offset: 2px;
    }

    .nav-section-title {
      padding: 24px 20px 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--app-sidebar-text-muted);
    }

    mat-nav-list a {
      border-radius: var(--app-radius-sm);
      margin: 2px 8px;
    }

    .toolbar-spacer {
      flex: 1 1 auto;
    }

    .username {
      margin-right: 16px;
      font-weight: 500;
      opacity: 0.9;
    }

    .main-content {
      padding: 24px 32px;
      background-color: var(--app-surface);
      min-height: calc(100vh - 64px);
      overflow: auto;
    }

    /* Enter animations */
    @keyframes routeEnter {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .route-enter { animation: routeEnter 200ms cubic-bezier(0.05, 0.7, 0.1, 1) forwards; }

    @media (max-width: 600px) {
      .main-content {
        padding: 16px;
      }
    }

    @media (min-width: 601px) and (max-width: 1024px) {
      .main-content {
        padding: 20px 24px;
      }
    }
  `,
})
export class AdminLayoutComponent {
  private static readonly SIDENAV_STORAGE_KEY = 'sidenav-open';

  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly breakpointService = inject(BreakpointService);
  private readonly dialog = inject(MatDialog);
  private readonly lineService = inject(LineService);

  readonly sidenavRef = viewChild<MatSidenav>('sidenav');
  readonly sidenavOpen = signal(this.loadSidenavState());

  private loadSidenavState(): boolean {
    const stored = localStorage.getItem(AdminLayoutComponent.SIDENAV_STORAGE_KEY);
    return stored !== 'false';
  }

  toggleSidenav(): void {
    const newState = !this.sidenavOpen();
    this.sidenavOpen.set(newState);
    localStorage.setItem(AdminLayoutComponent.SIDENAV_STORAGE_KEY, String(newState));
  }

  closeSidenavOnMobile(): void {
    if (this.breakpointService.isSmallScreen()) {
      this.sidenavOpen.set(false);
    }
  }

  openHubDisplay(): void {
    this.lineService.getAll().subscribe((lines) => {
      this.dialog
        .open(HubDisplayDialogComponent, {
          data: { lines },
          width: '550px',
        })
        .afterClosed()
        .subscribe((result: HubDisplayDialogResult | undefined) => {
          if (result) {
            const params = new URLSearchParams();
            params.set('stopIds', result.stopIds.join(','));
            params.set('name', result.hubName);
            window.open(`/hub?${params.toString()}`, '_blank');
          }
        });
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
