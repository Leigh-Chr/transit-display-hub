import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlexStopTimesComponent } from './flex-stop-times.component';
import { FlexStopTimeService } from '@core/api/flex-stop-time.service';
import { TranslocoTestingModule } from '@jsverse/transloco';

describe('FlexStopTimesComponent', () => {
  let mockFlexService: { browse: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockFlexService = {
      browse: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      imports: [
        FlexStopTimesComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: {}, fr: {} },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: FlexStopTimeService, useValue: mockFlexService },
      ],
    });
  });

  it('renders without errors', () => {
    const fixture = TestBed.createComponent(FlexStopTimesComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1, .flex-page')).toBeTruthy();
  });
});
