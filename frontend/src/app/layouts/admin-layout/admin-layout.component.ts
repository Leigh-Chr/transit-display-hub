import { Component, inject, signal, viewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { RouterModule, RouterLink, RouterLinkActive, ChildrenOutletContexts } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '@core/auth/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { BreakpointService } from '@core/services/breakpoint.service';
import { routeSlide } from '@shared/animations';

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
  animations: [routeSlide],
  template: `
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
          <h1>Transit Display Hub</h1>
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

          <a
            mat-list-item
            routerLink="/map"
            routerLinkActive="active-link"
            (click)="closeSidenavOnMobile()"
          >
            <mat-icon matListItemIcon>map</mat-icon>
            <span matListItemTitle>Network Map</span>
          </a>

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

          <a
            mat-list-item
            routerLink="/admin/devices"
            routerLinkActive="active-link"
            (click)="closeSidenavOnMobile()"
          >
            <mat-icon matListItemIcon>tv</mat-icon>
            <span matListItemTitle>Devices</span>
          </a>

          @if (authService.isAdmin()) {
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

      <mat-sidenav-content role="main">
        <mat-toolbar color="primary">
          <button
            mat-icon-button
            (click)="toggleSidenav()"
            aria-label="Toggle navigation menu"
            matTooltip="Toggle sidebar"
          >
            <mat-icon>{{ sidenavOpen() ? 'menu_open' : 'menu' }}</mat-icon>
          </button>
          <span class="toolbar-spacer"></span>
          <button
            mat-icon-button
            (click)="themeService.toggleTheme()"
            [matTooltip]="themeService.isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
            aria-label="Toggle dark mode"
          >
            <mat-icon>{{ themeService.isDarkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          @if (!breakpointService.isMobile()) {
            <span class="username">{{ authService.currentUser()?.username }}</span>
          }
          <button mat-button (click)="logout()">
            <mat-icon>logout</mat-icon>
            @if (!breakpointService.isMobile()) {
              Logout
            }
          </button>
        </mat-toolbar>

        <main class="main-content" [@routeSlide]="getRouteAnimationData()">
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
    }

    .sidenav-header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--app-sidebar-text);
      letter-spacing: -0.25px;
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
  private readonly contexts = inject(ChildrenOutletContexts);

  readonly sidenavRef = viewChild<MatSidenav>('sidenav');
  readonly sidenavOpen = signal(this.loadSidenavState());

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.url.toString() || '';
  }

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

  logout(): void {
    this.authService.logout();
  }
}
