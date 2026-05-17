import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';

import { FareCalculatorService } from '@core/api/fare-calculator.service';
import { StopService } from '@core/api/stop.service';
import { FareCalculationResult, Stop } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
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
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    EmptyStateComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fare-calculator.component.html',
  styleUrl: './fare-calculator.component.scss',
})
export class FareCalculatorComponent implements OnInit {
  private readonly fareService = inject(FareCalculatorService);
  private readonly stopService = inject(StopService);

  readonly origin = signal<Stop | null>(null);
  readonly dest = signal<Stop | null>(null);
  readonly originResults = signal<Stop[]>([]);
  readonly destResults = signal<Stop[]>([]);
  readonly result = signal<FareCalculationResult | null>(null);
  readonly errored = signal<boolean>(false);

  originText = '';
  destText = '';

  private allStops: Stop[] = [];

  readonly v1Cols = ['fareId', 'price', 'transfers', 'match'];
  readonly v2Cols = ['product', 'amount', 'from', 'to', 'priority'];

  ngOnInit(): void {
    this.stopService.getAll().subscribe({
      next: (data) => {
        this.allStops = data;
        this.originResults.set(data.slice(0, 30));
        this.destResults.set(data.slice(0, 30));
      },
      error: () => { this.allStops = []; },
    });
  }

  onSearch(field: 'origin' | 'dest'): void {
    const text = (field === 'origin' ? this.originText : this.destText).toLowerCase().trim();
    const filtered = !text
      ? this.allStops.slice(0, 30)
      : this.allStops.filter(s => s.name.toLowerCase().includes(text)).slice(0, 30);
    if (field === 'origin') {this.originResults.set(filtered);} else {this.destResults.set(filtered);}
  }

  onStopSelected(field: 'origin' | 'dest', stop: Stop): void {
    if (field === 'origin') {
      this.origin.set(stop);
      this.originText = stop.name;
    } else {
      this.dest.set(stop);
      this.destText = stop.name;
    }
  }

  displayStop(stop: Stop | string | null): string {
    if (!stop) {return '';}
    if (typeof stop === 'string') {return stop;}
    return stop.name;
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
