import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, CreateUserRequest, UpdateUserRequest, PageRequest, PageResponse } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly baseUrl = '/api/users';
  private readonly http = inject(HttpClient);

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl);
  }

  getAllPaginated(request: PageRequest = {}): Observable<PageResponse<User>> {
    let params = new HttpParams().set('page', String(request.page ?? 0));
    if (request.size) {params = params.set('size', String(request.size));}
    if (request.sortBy) {params = params.set('sortBy', request.sortBy);}
    if (request.sortDir) {params = params.set('sortDir', request.sortDir);}
    if (request.search) {params = params.set('search', request.search);}
    return this.http.get<PageResponse<User>>(this.baseUrl, { params });
  }

  get(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
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
