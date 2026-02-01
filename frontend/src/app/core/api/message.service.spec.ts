import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MessageService } from './message.service';
import { BroadcastMessage, CreateMessageRequest } from '@shared/models';

describe('MessageService', () => {
  let service: MessageService;
  let httpMock: HttpTestingController;

  const mockMessage: BroadcastMessage = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Alert',
    content: 'Test content',
    severity: 'INFO',
    startTime: '2024-01-01T00:00:00Z',
    endTime: '2024-12-31T23:59:59Z',
    scopeType: 'NETWORK',
    scopeId: null,
    scopeInfo: null,
    active: true
  };

  const mockMessages: BroadcastMessage[] = [
    mockMessage,
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      title: 'Line Alert',
      content: 'Line-specific content',
      severity: 'WARNING',
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-12-31T23:59:59Z',
      scopeType: 'LINE',
      scopeId: 'line-123',
      scopeInfo: { name: 'Metro Line 1', lineCode: 'L1', lineColor: '#FF5733' },
      active: true
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MessageService]
    });

    service = TestBed.inject(MessageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll', () => {
    it('should return all messages without filter', () => {
      service.getAll().subscribe(messages => {
        expect(messages).toEqual(mockMessages);
        expect(messages.length).toBe(2);
      });

      const req = httpMock.expectOne('/api/messages');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('active')).toBeFalse();
      req.flush(mockMessages);
    });

    it('should add active=true param when activeOnly is true', () => {
      service.getAll(true).subscribe(messages => {
        expect(messages).toEqual(mockMessages);
      });

      const req = httpMock.expectOne('/api/messages?active=true');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('active')).toBe('true');
      req.flush(mockMessages);
    });

    it('should not add active param when activeOnly is false', () => {
      service.getAll(false).subscribe(messages => {
        expect(messages).toEqual(mockMessages);
      });

      const req = httpMock.expectOne('/api/messages');
      expect(req.request.params.has('active')).toBeFalse();
      req.flush(mockMessages);
    });

    it('should return empty array when no messages', () => {
      service.getAll().subscribe(messages => {
        expect(messages).toEqual([]);
      });

      const req = httpMock.expectOne('/api/messages');
      req.flush([]);
    });
  });

  describe('get', () => {
    it('should return a single message by id', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.get(id).subscribe(message => {
        expect(message).toEqual(mockMessage);
        expect(message.title).toBe('Test Alert');
      });

      const req = httpMock.expectOne(`/api/messages/${id}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockMessage);
    });

    it('should propagate 404 error for non-existent message', () => {
      const id = 'non-existent-id';

      service.get(id).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/messages/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('create', () => {
    it('should create a NETWORK scope message', () => {
      const request: CreateMessageRequest = {
        title: 'New Alert',
        content: 'New content',
        severity: 'CRITICAL',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-12-31T23:59:59Z',
        scopeType: 'NETWORK'
      };
      const createdMessage: BroadcastMessage = {
        id: '333e4567-e89b-12d3-a456-426614174000',
        title: request.title,
        content: request.content,
        severity: request.severity,
        startTime: request.startTime,
        endTime: request.endTime,
        scopeType: request.scopeType,
        scopeId: null,
        scopeInfo: null,
        active: true
      };

      service.create(request).subscribe(message => {
        expect(message).toEqual(createdMessage);
        expect(message.scopeType).toBe('NETWORK');
      });

      const req = httpMock.expectOne('/api/messages');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(createdMessage);
    });

    it('should create a LINE scope message with scopeId', () => {
      const request: CreateMessageRequest = {
        title: 'Line Alert',
        content: 'Line content',
        severity: 'WARNING',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-12-31T23:59:59Z',
        scopeType: 'LINE',
        scopeId: 'line-123'
      };

      service.create(request).subscribe();

      const req = httpMock.expectOne('/api/messages');
      expect(req.request.body.scopeType).toBe('LINE');
      expect(req.request.body.scopeId).toBe('line-123');
      req.flush({ ...request, id: 'new-id', scopeInfo: null, active: true });
    });

    it('should create a STOP scope message with scopeId', () => {
      const request: CreateMessageRequest = {
        title: 'Stop Alert',
        content: 'Stop content',
        severity: 'INFO',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-12-31T23:59:59Z',
        scopeType: 'STOP',
        scopeId: 'stop-456'
      };

      service.create(request).subscribe();

      const req = httpMock.expectOne('/api/messages');
      expect(req.request.body.scopeType).toBe('STOP');
      expect(req.request.body.scopeId).toBe('stop-456');
      req.flush({ ...request, id: 'new-id', scopeInfo: null, active: true });
    });

    it('should propagate validation errors', () => {
      const request: CreateMessageRequest = {
        title: '',
        content: 'Content',
        severity: 'INFO',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-12-31T23:59:59Z',
        scopeType: 'NETWORK'
      };

      service.create(request).subscribe({
        error: (err) => {
          expect(err.status).toBe(400);
        }
      });

      const req = httpMock.expectOne('/api/messages');
      req.flush({ message: 'Title is required' }, { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('update', () => {
    it('should update an existing message', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: CreateMessageRequest = {
        title: 'Updated Alert',
        content: 'Updated content',
        severity: 'CRITICAL',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-12-31T23:59:59Z',
        scopeType: 'NETWORK'
      };
      const updatedMessage: BroadcastMessage = {
        id,
        title: request.title,
        content: request.content,
        severity: request.severity,
        startTime: request.startTime,
        endTime: request.endTime,
        scopeType: request.scopeType,
        scopeId: null,
        scopeInfo: null,
        active: true
      };

      service.update(id, request).subscribe(message => {
        expect(message).toEqual(updatedMessage);
        expect(message.title).toBe('Updated Alert');
      });

      const req = httpMock.expectOne(`/api/messages/${id}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(updatedMessage);
    });

    it('should propagate 404 error for non-existent message', () => {
      const id = 'non-existent-id';
      const request: CreateMessageRequest = {
        title: 'Alert',
        content: 'Content',
        severity: 'INFO',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-12-31T23:59:59Z',
        scopeType: 'NETWORK'
      };

      service.update(id, request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/messages/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('delete', () => {
    it('should delete a message', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.delete(id).subscribe(() => {
        // Success - no response body expected
      });

      const req = httpMock.expectOne(`/api/messages/${id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should propagate 404 error for non-existent message', () => {
      const id = 'non-existent-id';

      service.delete(id).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/messages/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });
});
