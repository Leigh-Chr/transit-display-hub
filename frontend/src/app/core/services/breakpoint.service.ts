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
      .pipe(map((r) => r.breakpoints[Breakpoints.XSmall] ?? false)),
    { initialValue: false }
  );

  // Small screen (mobile or tablet)
  readonly isSmallScreen = toSignal(
    this.breakpointObserver.observe(['(max-width: 1024px)']).pipe(map((r) => r.matches)),
    { initialValue: false }
  );
}
