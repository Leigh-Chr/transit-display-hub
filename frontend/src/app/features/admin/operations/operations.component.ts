import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective } from '@jsverse/transloco';

/**
 * Wrapper that groups the two operational read-only surfaces (live
 * GTFS-RT caches + import history) under a single admin entry. The
 * tab nav bar drives the URL so each tab is a real deep-link
 * (`/admin/operations/realtime`, `/admin/operations/import-history`).
 */
@Component({
  selector: 'app-operations',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatTabsModule,
    MatIconModule,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operations.component.html',
  styleUrl: './operations.component.scss',
})
export class OperationsComponent {}
