import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User, CreateUserRequest, UpdateUserRequest } from '@shared/models';
import { CrudResource } from './crud-resource';

/**
 * UserService — pilot migration to the CrudResource pattern. The five
 * other CRUD services (stop, line, itinerary, message, schedule) still
 * ship their own copies because each one has feature-specific filters
 * (lineId, active, etc.) layered on top of the CRUD surface. A
 * subsequent commit can fold them in by introducing a {@code paramsFor}
 * hook on the base.
 */
@Injectable({
  providedIn: 'root'
})
export class UserService extends CrudResource<User, CreateUserRequest, UpdateUserRequest> {
  protected readonly baseUrl = '/api/users';
  protected readonly http = inject(HttpClient);
}
