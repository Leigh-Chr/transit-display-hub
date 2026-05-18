import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { testTranslocoModule } from '../../../../test-translations';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkListComponent } from './network-list.component';
import { NetworkMapDataService } from '@features/network-map/services/network-map-data.service';
import { NetworkMap } from '@shared/models';

const mockNetworkMap: NetworkMap = {
  lines: [],
  stops: [],
  bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
};

describe('NetworkListComponent', () => {
  let mockDataService: { getNetworkMap: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDataService = {
      getNetworkMap: vi.fn().mockReturnValue(of(mockNetworkMap)),
    };

    TestBed.configureTestingModule({
      imports: [
        NetworkListComponent,
        testTranslocoModule({}),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NetworkMapDataService, useValue: mockDataService },
      ],
    });
  });

  it('renders without errors', () => {
    const fixture = TestBed.createComponent(NetworkListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1, header, .page')).not.toBeNull();
  });
});
