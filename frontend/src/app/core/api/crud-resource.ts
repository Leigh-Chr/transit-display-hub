import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PageRequest, PageResponse } from '@shared/models';
import { pageRequestToHttpParams } from '@shared/utils/page-request.utils';

/**
 * Generic CRUD wrapper for the standard list/page/create/update/delete
 * surface seven of the admin services were re-implementing identically.
 *
 * Each subclass picks the entity type, optional update / list-request
 * types, and the base URL — the rest is provided here. Subclasses that
 * need to filter the paginated list override {@code extraListParams};
 * subclasses with an unpaginated `/all` filter use {@code getAllListed}
 * with the same `{ key: value }` shape.
 *
 * Note the single eslint-disable for {@code no-invalid-void-type} — a
 * known typescript-eslint quirk with expression-level void generics.
 * Centralising the disable here removes the same comment from each
 * concrete service.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TUpdateReq and TListReq are used in subclass overrides (UserService narrows TCreateReq → UpdateUserRequest; StopService/MessageService/ItineraryService narrow PageRequest → their typed filter shape)
export abstract class CrudResource<TEntity, TCreateReq, TUpdateReq = TCreateReq, TListReq extends PageRequest = PageRequest> {
  protected abstract readonly baseUrl: string;
  protected abstract readonly http: HttpClient;

  /** Hook for subclasses to map their filter shape into the query
   *  string of {@link #getAllPaginated}. Default = no extra params. */
  protected extraListParams(_request: TListReq): Record<string, string | undefined> {
    return {};
  }

  getAllPaginated(request: TListReq = {} as TListReq): Observable<PageResponse<TEntity>> {
    const params = pageRequestToHttpParams(
      { ...request, page: request.page ?? 0 },
      this.extraListParams(request),
    );
    return this.http.get<PageResponse<TEntity>>(this.baseUrl, { params });
  }

  /** Helper for subclasses to expose a typed {@code getAll(filter)}
   *  signature without re-implementing the `${baseUrl}/all` plumbing.
   *  `undefined` entries are dropped silently. */
  protected getAllListed(extras: Record<string, string | undefined> = {}): Observable<TEntity[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(extras)) {
      if (value !== undefined) {
        params = params.set(key, value);
      }
    }
    return this.http.get<TEntity[]>(`${this.baseUrl}/all`, { params });
  }

  create(request: TCreateReq): Observable<TEntity> {
    return this.http.post<TEntity>(this.baseUrl, request);
  }

  update(id: string, request: TUpdateReq): Observable<TEntity> {
    return this.http.put<TEntity>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- known typescript-eslint quirk with expression-level void generics
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
