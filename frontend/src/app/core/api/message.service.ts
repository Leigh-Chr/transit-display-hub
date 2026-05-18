import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BroadcastMessage, CreateMessageRequest, MessageSeverity, PageRequest } from '@shared/models';
import { CrudResource } from './crud-resource';

export interface MessagePageRequest extends PageRequest {
  active?: boolean | undefined;
  severity?: MessageSeverity | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService extends CrudResource<BroadcastMessage, CreateMessageRequest, CreateMessageRequest, MessagePageRequest> {
  protected readonly baseUrl = '/api/messages';
  protected readonly http = inject(HttpClient);

  protected override extraListParams(request: MessagePageRequest): Record<string, string | undefined> {
    return {
      active: request.active ? 'true' : undefined,
      severity: request.severity,
    };
  }

  getAll(activeOnly = false): Observable<BroadcastMessage[]> {
    return this.getAllListed({ active: activeOnly ? 'true' : undefined });
  }
}
