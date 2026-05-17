import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';

import { FareCalculatorService } from '@core/api/fare-calculator.service';
import { StopService } from '@core/api/stop.service';
import { FareCalculationResult, Stop } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { StopAutocompleteComponent, StopAutocompleteOption } from '@shared/components/stop-autocomplete/stop-autocomplete.component';
import { TranslocoDirective } from '@jsverse/transloco';

/**
 * Admin tool to test the public fare calculator without leaving the
 * back-office. Pick an origin stop, a destination stop, hit "Calculate"
 * — the page renders both V1 (fare_attributes + fare_rules) and V2
 * (fare_leg_rules + areas) options side by side.
 */
@Component({
  selector: 'app-fare-calculator',
  standalone: true,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    EmptyStateComponent,
    StopAutocompleteComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fare-calculator.component.html',
  styleUrl: './fare-calculator.component.scss',
})
export class FareCalculatorComponent {
  private readonly fareService = inject(FareCalculatorService);
  private readonly stopService = inject(StopService);

  readonly origin = signal<Stop | null>(null);
  readonly dest = signal<Stop | null>(null);
  readonly allStops = signal<readonly Stop[]>([]);
  readonly result = signal<FareCalculationResult | null>(null);
  readonly errored = signal<boolean>(false);

  readonly v1Cols = ['fareId', 'price', 'transfers', 'match'];
  readonly v2Cols = ['product', 'amount', 'from', 'to', 'priority'];

  constructor() {
    this.stopService.getAll().subscribe({
      next: (data) => this.allStops.set(data),
      error: () => this.allStops.set([]),
    });
  }

  /** Bound to the shared autocomplete output; narrows back to the
   *  concrete {@link Stop} type since the row came from
   *  {@code allStops()} which we typed ourselves. */
  onOriginSelected(stop: StopAutocompleteOption): void {
    this.origin.set(stop as Stop);
  }

  onDestSelected(stop: StopAutocompleteOption): void {
    this.dest.set(stop as Stop);
  }

  calculate(): void {
    const o = this.origin();
    const d = this.dest();
    if (!o || !d) {return;}
    this.errored.set(false);
    this.fareService.calculate(o.id, d.id).subscribe({
      next: (r) => {
        if (r) {
          this.result.set(r);
        } else {
          this.errored.set(true);
          this.result.set(null);
        }
      },
      error: () => {
        this.errored.set(true);
        this.result.set(null);
      },
    });
  }

  formatTransfers(t: number | null): string {
    if (t === null) {return '∞';}
    return String(t);
  }
}
