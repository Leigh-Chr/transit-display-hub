import { ChangeDetectionStrategy, Component, HostListener, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { NgOptimizedImage } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { BreakpointService } from '@core/services/breakpoint.service';
import { LocaleService } from '@core/i18n/locale.service';
import { SidenavBadgesService } from '@core/services/sidenav-badges.service';
import { A11yToolbarComponent } from '@shared/components/a11y-toolbar/a11y-toolbar.component';
import { CommandPaletteComponent } from './command-palette.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    NgOptimizedImage,
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
    TranslocoDirective,
    A11yToolbarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  private static readonly SIDENAV_STORAGE_KEY = 'sidenav-open';

  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly breakpointService = inject(BreakpointService);
  readonly localeService = inject(LocaleService);
  readonly sidenavBadges = inject(SidenavBadgesService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  /** Path-based breadcrumb trail derived from the current admin URL.
   *  Re-computed on every NavigationEnd. Empty when the trail is just
   *  "/admin/dashboard" (no point rendering a one-item breadcrumb).
   *  Each item carries the i18n key for its label and the absolute path
   *  to navigate to. */
  readonly breadcrumbs = signal<{ labelKey: string; path: string }[]>(
    buildBreadcrumbs(this.router.url),
  );

  readonly sidenavRef = viewChild<MatSidenav>('sidenav');
  readonly sidenavOpen = signal(this.loadSidenavState());

  private commandPaletteRef: ReturnType<MatDialog['open']> | null = null;

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.breadcrumbs.set(buildBreadcrumbs(e.urlAfterRedirects));
      });
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

  /** Open the global navigation palette. Toggle so a second Cmd+K hides
   *  it instead of stacking dialogs. */
  openCommandPalette(): void {
    if (this.commandPaletteRef) {
      this.commandPaletteRef.close();
      return;
    }
    this.commandPaletteRef = this.dialog.open(CommandPaletteComponent, {
      width: '560px',
      maxWidth: '92vw',
      panelClass: 'command-palette-dialog',
      autoFocus: 'first-tabbable',
    });
    this.commandPaletteRef.afterClosed().subscribe(() => {
      this.commandPaletteRef = null;
    });
  }

  /** Global Cmd+K / Ctrl+K shortcut — listens at the document level so
   *  it fires whether the focus is on a routed child or the admin shell
   *  itself. */
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openCommandPalette();
    }
  }
}

/** URL → breadcrumb trail. Strips the leading "/admin" prefix and maps
 *  each remaining segment to a known i18n nav label, falling back to
 *  the raw segment so unknown routes still render something useful. */
function buildBreadcrumbs(url: string): { labelKey: string; path: string }[] {
  const cleanUrl = url.split('?')[0]?.split('#')[0] ?? url;
  if (!cleanUrl.startsWith('/admin')) {
    return [];
  }
  const segments = cleanUrl.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
  // A single segment under /admin (e.g. /admin/lines or /admin/dashboard)
  // is already shown as the page <h1>; the breadcrumb adds noise.
  if (segments.length <= 1) {
    return [];
  }
  const trail: { labelKey: string; path: string }[] = [
    { labelKey: 'admin.navigation.dashboard', path: '/admin/dashboard' },
  ];
  let accumulated = '/admin';
  for (const segment of segments) {
    accumulated += `/${segment}`;
    trail.push({
      labelKey: BREADCRUMB_LABELS[segment] ?? segment,
      path: accumulated,
    });
  }
  return trail;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'admin.navigation.dashboard',
  messages: 'admin.navigation.messages',
  lines: 'admin.navigation.lines',
  stops: 'admin.navigation.stops',
  itineraries: 'admin.navigation.itineraries',
  schedules: 'admin.navigation.schedules',
  devices: 'admin.navigation.devices',
  operations: 'admin.navigation.operations',
  realtime: 'admin.navigation.realtime',
  'import-history': 'admin.navigation.importAudit',
  users: 'admin.navigation.users',
};
