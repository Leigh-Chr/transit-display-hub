import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, CreateUserRequest, UpdateUserRequest, PageRequest, PageResponse } from '@shared/models';
import { pageRequestToHttpParams } from '@shared/utils/page-request.utils';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly baseUrl = '/api/users';
  private readonly http = inject(HttpClient);

  getAllPaginated(request: PageRequest = {}): Observable<PageResponse<User>> {
    const params = pageRequestToHttpParams({ ...request, page: request.page ?? 0 });
    return this.http.get<PageResponse<User>>(this.baseUrl, { params });
  }

  create(request: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.baseUrl, request);
  }

  update(id: string, request: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- known typescript-eslint issue with expression-level generics
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
