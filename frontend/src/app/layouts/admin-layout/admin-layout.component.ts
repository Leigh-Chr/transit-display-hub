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
import { NgOptimizedImage } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';
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
