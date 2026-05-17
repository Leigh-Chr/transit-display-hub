import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSimpleListResource } from './simple-list-resource';

describe('createSimpleListResource', () => {
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    injector = TestBed.inject(Injector);
  });

  /** rxResource bridges its initial load through queueMicrotask / async
   *  effects. Flushing one microtask + one Promise resolution gives the
   *  loader enough room to commit a value or an error to the signals. */
  async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    TestBed.tick();
  }

  it('starts in the loading state and exposes the fetched items', async () => {
    const fetcher = vi.fn().mockReturnValue(of([{ id: '1', name: 'A' }]));

    const resource = runInInjectionContext(injector, () =>
      createSimpleListResource(fetcher),
    );

    expect(resource.loading()).toBe(true);
    expect(resource.items()).toEqual([]);
    expect(resource.error()).toBeUndefined();

    await flush();

    expect(resource.loading()).toBe(false);
    expect(resource.items()).toEqual([{ id: '1', name: 'A' }]);
    expect(resource.error()).toBeUndefined();
  });

  it('surfaces an error when the fetcher fails and keeps items empty', async () => {
    const fetcher = vi.fn().mockReturnValue(throwError(() => new Error('boom')));

    const resource = runInInjectionContext(injector, () =>
      createSimpleListResource(fetcher),
    );

    await flush();

    expect(resource.loading()).toBe(false);
    expect(resource.error()).toBeInstanceOf(Error);
    expect((resource.error() as Error).message).toBe('boom');
    expect(resource.items()).toEqual([]);
  });

  it('unwraps non-Error throwables so HTTP error payloads stay accessible', async () => {
    // Mirrors HttpClient: rxResource wraps non-Error values in a
    // ResourceWrappedError whose .cause is the original payload. The
    // helper hands the original back so callers don't have to know
    // about the envelope.
    const httpErr = { status: 500, error: { message: 'Boom from server' } };
    const fetcher = vi.fn().mockReturnValue(throwError(() => httpErr));

    const resource = runInInjectionContext(injector, () =>
      createSimpleListResource(fetcher),
    );

    await flush();

    expect(resource.error()).toBe(httpErr);
  });

  it('reload() re-invokes the fetcher and updates the snapshot', async () => {
    const subject = new Subject<readonly { id: string }[]>();
    const fetcher = vi.fn().mockReturnValue(subject.asObservable());

    const resource = runInInjectionContext(injector, () =>
      createSimpleListResource<{ id: string }>(fetcher),
    );

    // rxResource is lazy — reading a signal once is enough to kick the loader.
    resource.loading();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);

    subject.next([{ id: '1' }]);
    subject.complete();
    await flush();
    expect(resource.items()).toEqual([{ id: '1' }]);

    const reSubject = new Subject<readonly { id: string }[]>();
    fetcher.mockReturnValueOnce(reSubject.asObservable());

    resource.reload();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);

    reSubject.next([{ id: '1' }, { id: '2' }]);
    reSubject.complete();
    await flush();
    expect(resource.items()).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
