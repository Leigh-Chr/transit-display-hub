import { Injectable, inject } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly breakpointObserver = inject(BreakpointObserver);

  // Mobile: < 600px
  readonly isMobile = toSignal(
    this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small])
      .pipe(map((r) => r.breakpoints[Breakpoints.XSmall] || false)),
    { initialValue: false }
  );

  // Tablet: 600-1024px
  readonly isTablet = toSignal(
    this.breakpointObserver
      .observe(['(min-width: 600px) and (max-width: 1024px)'])
      .pipe(map((r) => r.matches)),
    { initialValue: false }
  );

  // Desktop: > 1024px
  readonly isDesktop = toSignal(
    this.breakpointObserver.observe(['(min-width: 1025px)']).pipe(map((r) => r.matches)),
    { initialValue: true }
  );

  // Handset (portrait phone)
  readonly isHandset = toSignal(
    this.breakpointObserver.observe([Breakpoints.Handset]).pipe(map((r) => r.matches)),
    { initialValue: false }
  );

  // Small screen (mobile or tablet)
  readonly isSmallScreen = toSignal(
    this.breakpointObserver.observe(['(max-width: 1024px)']).pipe(map((r) => r.matches)),
    { initialValue: false }
  );
}
