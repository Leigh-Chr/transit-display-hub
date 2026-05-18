import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PageRequest, PageResponse } from '@shared/models';
import { pageRequestToHttpParams } from '@shared/utils/page-request.utils';

/**
 * Generic CRUD wrapper for the standard list/page/create/update/delete
 * surface seven of the admin services were re-implementing identically.
 *
 * Each subclass picks the entity type (and an optional update-request
 * type when it differs from create) plus the base URL — the rest is
 * provided here. Subclasses with extra parameters (filter by lineId,
 * activeOnly, …) can still add their own methods on top.
 *
 * Note the single eslint-disable for {@code no-invalid-void-type} — a
 * known typescript-eslint quirk with expression-level void generics.
 * Centralising the disable here removes the same comment from each
 * concrete service.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TUpdateReq is used in subclass override signatures (UserService.update narrows the input from TCreateReq to UpdateUserRequest)
export abstract class CrudResource<TEntity, TCreateReq, TUpdateReq = TCreateReq> {
  protected abstract readonly baseUrl: string;
  protected abstract readonly http: HttpClient;

  getAllPaginated(request: PageRequest = {}): Observable<PageResponse<TEntity>> {
    const params = pageRequestToHttpParams({ ...request, page: request.page ?? 0 });
    return this.http.get<PageResponse<TEntity>>(this.baseUrl, { params });
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
