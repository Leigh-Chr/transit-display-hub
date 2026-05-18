import { ChangeDetectionStrategy, Component, HostListener, inject, signal, viewChild } from '@angular/core';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
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
  private readonly dialog = inject(MatDialog);

  readonly sidenavRef = viewChild<MatSidenav>('sidenav');
  readonly sidenavOpen = signal(this.loadSidenavState());

  private commandPaletteRef: ReturnType<MatDialog['open']> | null = null;

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
