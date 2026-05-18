import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FareCalculatorComponent } from './fare-calculator.component';
import { FareCalculatorService } from '@core/api/fare-calculator.service';
import { StopService } from '@core/api/stop.service';
import { testTranslocoModule } from '../../../../test-translations';

describe('FareCalculatorComponent', () => {
  let mockFareService: { calculate: ReturnType<typeof vi.fn> };
  let mockStopService: { getAll: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockFareService = {
      calculate: vi.fn().mockReturnValue(of(null)),
    };

    mockStopService = {
      getAll: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      imports: [
        FareCalculatorComponent,
        testTranslocoModule({}),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: FareCalculatorService, useValue: mockFareService },
        { provide: StopService, useValue: mockStopService },
      ],
    });
  });

  it('renders without errors', () => {
    const fixture = TestBed.createComponent(FareCalculatorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1, .fare-page')).not.toBeNull();
  });
});
