import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LineService } from './line.service';
import { Line, CreateLineRequest } from '@shared/models';

describe('LineService', () => {
  let service: LineService;
  let httpMock: HttpTestingController;

  const mockLine: Line = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    code: 'L1',
    name: 'Metro Line 1',
    color: '#FF5733',
    stopCount: 5
  };

  const mockLines: Line[] = [
    mockLine,
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      code: 'L2',
      name: 'Metro Line 2',
      color: '#33FF57',
      stopCount: 8
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LineService]
    });

    service = TestBed.inject(LineService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll', () => {
    it('should return all lines', () => {
      service.getAll().subscribe(lines => {
        expect(lines).toEqual(mockLines);
        expect(lines.length).toBe(2);
      });

      const req = httpMock.expectOne('/api/lines');
      expect(req.request.method).toBe('GET');
      req.flush(mockLines);
    });

    it('should return empty array when no lines', () => {
      service.getAll().subscribe(lines => {
        expect(lines).toEqual([]);
        expect(lines.length).toBe(0);
      });

      const req = httpMock.expectOne('/api/lines');
      req.flush([]);
    });
  });

  describe('get', () => {
    it('should return a single line by id', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.get(id).subscribe(line => {
        expect(line).toEqual(mockLine);
        expect(line.id).toBe(id);
      });

      const req = httpMock.expectOne(`/api/lines/${id}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockLine);
    });

    it('should propagate 404 error for non-existent line', () => {
      const id = 'non-existent-id';

      service.get(id).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/lines/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('create', () => {
    it('should create a new line', () => {
      const request: CreateLineRequest = {
        code: 'L3',
        name: 'New Line',
        color: '#0000FF'
      };
      const createdLine: Line = {
        id: '333e4567-e89b-12d3-a456-426614174000',
        ...request,
        stopCount: 0
      };

      service.create(request).subscribe(line => {
        expect(line).toEqual(createdLine);
        expect(line.code).toBe('L3');
      });

      const req = httpMock.expectOne('/api/lines');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(createdLine);
    });

    it('should propagate validation errors', () => {
      const request: CreateLineRequest = {
        code: 'L1', // duplicate
        name: 'Duplicate Line',
        color: '#FF0000'
      };

      service.create(request).subscribe({
        error: (err) => {
          expect(err.status).toBe(400);
        }
      });

      const req = httpMock.expectOne('/api/lines');
      req.flush({ message: 'Line code already exists' }, { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('update', () => {
    it('should update an existing line', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: CreateLineRequest = {
        code: 'L1-NEW',
        name: 'Updated Line',
        color: '#00FF00'
      };
      const updatedLine: Line = {
        id,
        ...request,
        stopCount: 5
      };

      service.update(id, request).subscribe(line => {
        expect(line).toEqual(updatedLine);
        expect(line.name).toBe('Updated Line');
      });

      const req = httpMock.expectOne(`/api/lines/${id}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(updatedLine);
    });

    it('should propagate 404 error for non-existent line', () => {
      const id = 'non-existent-id';
      const request: CreateLineRequest = {
        code: 'L1',
        name: 'Line',
        color: '#FF0000'
      };

      service.update(id, request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/lines/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('delete', () => {
    it('should delete a line', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.delete(id).subscribe(() => {
        // Success - no response body expected
      });

      const req = httpMock.expectOne(`/api/lines/${id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should propagate 404 error for non-existent line', () => {
      const id = 'non-existent-id';

      service.delete(id).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/lines/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });
});
