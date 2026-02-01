import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { MessageService } from '@core/api/message.service';
import { Line, Stop, BroadcastMessage, CreateMessageRequest, MessageSeverity, MessageScope } from '@shared/models';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-neutral-900">Broadcast Messages</h1>
        <button (click)="openCreateModal()" class="btn btn-primary">
          + New Message
        </button>
      </div>

      <!-- Filter -->
      <div class="mb-4 flex gap-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            [(ngModel)]="showActiveOnly"
            (ngModelChange)="loadMessages()"
            class="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span class="text-sm text-neutral-700">Active only</span>
        </label>
      </div>

      <!-- Messages List -->
      <div class="space-y-4">
        @for (message of messages(); track message.id) {
          <div class="card">
            <div class="flex items-start gap-4 p-4">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                [class.bg-red-500]="message.severity === 'CRITICAL'"
                [class.bg-orange-500]="message.severity === 'WARNING'"
                [class.bg-blue-500]="message.severity === 'INFO'">
                @switch (message.severity) {
                  @case ('CRITICAL') { <span>!</span> }
                  @case ('WARNING') { <span>⚠</span> }
                  @default { <span>i</span> }
                }
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-semibold text-neutral-900">{{ message.title }}</h3>
                  <span
                    class="px-2 py-0.5 text-xs rounded-full"
                    [class.bg-red-100]="message.severity === 'CRITICAL'"
                    [class.text-red-700]="message.severity === 'CRITICAL'"
                    [class.bg-orange-100]="message.severity === 'WARNING'"
                    [class.text-orange-700]="message.severity === 'WARNING'"
                    [class.bg-blue-100]="message.severity === 'INFO'"
                    [class.text-blue-700]="message.severity === 'INFO'">
                    {{ message.severity }}
                  </span>
                  @if (isActive(message)) {
                    <span class="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">ACTIVE</span>
                  } @else {
                    <span class="px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-600">INACTIVE</span>
                  }
                </div>
                <p class="text-neutral-600 mb-2">{{ message.content }}</p>
                <div class="text-sm text-neutral-500">
                  <span class="font-medium">Scope:</span>
                  @switch (message.scopeType) {
                    @case ('NETWORK') { <span>Entire Network</span> }
                    @case ('LINE') { <span>Line: {{ message.scopeInfo?.name }}</span> }
                    @case ('STOP') { <span>Stop: {{ message.scopeInfo?.name }}</span> }
                  }
                  <span class="mx-2">|</span>
                  <span>{{ message.startTime | date:'short' }} - {{ message.endTime | date:'short' }}</span>
                </div>
              </div>
              <div class="flex gap-2">
                <button (click)="openEditModal(message)" class="text-primary-600 hover:text-primary-800">
                  Edit
                </button>
                <button (click)="deleteMessage(message)" class="text-red-600 hover:text-red-800">
                  Delete
                </button>
              </div>
            </div>
          </div>
        } @empty {
          <div class="card p-8 text-center text-neutral-500">
            No messages found. Create your first broadcast message.
          </div>
        }
      </div>

      <!-- Create/Edit Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div class="px-6 py-4 border-b border-neutral-200">
              <h2 class="text-lg font-semibold text-neutral-900">
                {{ editingMessage() ? 'Edit Message' : 'New Broadcast Message' }}
              </h2>
            </div>
            <form (ngSubmit)="saveMessage()" class="p-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Title</label>
                  <input
                    type="text"
                    [(ngModel)]="form.title"
                    name="title"
                    class="input"
                    placeholder="e.g., Service Disruption"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Content</label>
                  <textarea
                    [(ngModel)]="form.content"
                    name="content"
                    class="input"
                    rows="3"
                    placeholder="Detailed message content..."
                    required
                  ></textarea>
                </div>
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Severity</label>
                  <select [(ngModel)]="form.severity" name="severity" class="input" required>
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Scope</label>
                  <select [(ngModel)]="form.scopeType" name="scopeType" class="input" required (ngModelChange)="onScopeChange()">
                    <option value="NETWORK">Entire Network</option>
                    <option value="LINE">Specific Line</option>
                    <option value="STOP">Specific Stop</option>
                  </select>
                </div>
                @if (form.scopeType === 'LINE' || form.scopeType === 'STOP') {
                  <div>
                    <label class="block text-sm font-medium text-neutral-700 mb-1">Line</label>
                    <select [(ngModel)]="form.lineId" name="lineId" class="input" required (ngModelChange)="onLineChange()">
                      <option value="">Select a line</option>
                      @for (line of lines(); track line.id) {
                        <option [value]="line.id">{{ line.code }} - {{ line.name }}</option>
                      }
                    </select>
                  </div>
                }
                @if (form.scopeType === 'STOP') {
                  <div>
                    <label class="block text-sm font-medium text-neutral-700 mb-1">Stop</label>
                    <select [(ngModel)]="form.stopId" name="stopId" class="input" required [disabled]="!form.lineId">
                      <option value="">Select a stop</option>
                      @for (stop of stops(); track stop.id) {
                        <option [value]="stop.id">{{ stop.name }}</option>
                      }
                    </select>
                  </div>
                }
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-neutral-700 mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      [(ngModel)]="form.startTime"
                      name="startTime"
                      class="input"
                      required
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-neutral-700 mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      [(ngModel)]="form.endTime"
                      name="endTime"
                      class="input"
                      required
                    />
                  </div>
                </div>
              </div>
              <div class="flex justify-end gap-3 mt-6">
                <button type="button" (click)="closeModal()" class="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  {{ editingMessage() ? 'Save Changes' : 'Create Message' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class MessagesComponent implements OnInit {
  messages = signal<BroadcastMessage[]>([]);
  lines = signal<Line[]>([]);
  stops = signal<Stop[]>([]);
  showModal = signal(false);
  editingMessage = signal<BroadcastMessage | null>(null);
  showActiveOnly = true;

  form = {
    title: '',
    content: '',
    severity: 'INFO' as MessageSeverity,
    scopeType: 'NETWORK' as MessageScope,
    lineId: '',  // Used for UI only
    stopId: '',  // Used for UI only
    startTime: '',
    endTime: ''
  };

  constructor(
    private messageService: MessageService,
    private lineService: LineService,
    private stopService: StopService
  ) {}

  ngOnInit(): void {
    this.loadMessages();
    this.lineService.getAll().subscribe(lines => this.lines.set(lines));
  }

  loadMessages(): void {
    this.messageService.getAll(this.showActiveOnly).subscribe(messages => this.messages.set(messages));
  }

  isActive(message: BroadcastMessage): boolean {
    const now = new Date();
    return new Date(message.startTime) <= now && now <= new Date(message.endTime);
  }

  onScopeChange(): void {
    if (this.form.scopeType === 'NETWORK') {
      this.form.lineId = '';
      this.form.stopId = '';
    } else if (this.form.scopeType === 'LINE') {
      this.form.stopId = '';
    }
  }

  onLineChange(): void {
    this.form.stopId = '';
    if (this.form.lineId) {
      this.stopService.getAll(this.form.lineId).subscribe(stops => this.stops.set(stops));
    } else {
      this.stops.set([]);
    }
  }

  openCreateModal(): void {
    this.editingMessage.set(null);
    const now = new Date();
    const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    this.form = {
      title: '',
      content: '',
      severity: 'INFO',
      scopeType: 'NETWORK',
      lineId: '',
      stopId: '',
      startTime: this.toLocalDatetime(now),
      endTime: this.toLocalDatetime(later)
    };
    this.showModal.set(true);
  }

  openEditModal(message: BroadcastMessage): void {
    this.editingMessage.set(message);
    // For LINE scope, scopeId is the lineId; for STOP scope, we need to load stops for that line
    if (message.scopeType === 'LINE' && message.scopeId) {
      this.form.lineId = message.scopeId;
    } else if (message.scopeType === 'STOP' && message.scopeId) {
      // For STOP scope, we need to find the line first - load stops will be called when line changes
      // The scopeInfo might have lineCode which we could use, but we'd need to map it to lineId
      this.form.stopId = message.scopeId;
    }
    this.form = {
      title: message.title,
      content: message.content,
      severity: message.severity,
      scopeType: message.scopeType,
      lineId: message.scopeType === 'LINE' ? message.scopeId || '' : '',
      stopId: message.scopeType === 'STOP' ? message.scopeId || '' : '',
      startTime: this.toLocalDatetime(new Date(message.startTime)),
      endTime: this.toLocalDatetime(new Date(message.endTime))
    };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingMessage.set(null);
  }

  saveMessage(): void {
    // Determine scopeId based on scopeType
    let scopeId: string | undefined;
    if (this.form.scopeType === 'LINE') {
      scopeId = this.form.lineId || undefined;
    } else if (this.form.scopeType === 'STOP') {
      scopeId = this.form.stopId || undefined;
    }

    const request: CreateMessageRequest = {
      title: this.form.title,
      content: this.form.content,
      severity: this.form.severity,
      scopeType: this.form.scopeType,
      scopeId,
      startTime: new Date(this.form.startTime).toISOString(),
      endTime: new Date(this.form.endTime).toISOString()
    };

    const editing = this.editingMessage();
    if (editing) {
      this.messageService.update(editing.id, request).subscribe(() => {
        this.loadMessages();
        this.closeModal();
      });
    } else {
      this.messageService.create(request).subscribe(() => {
        this.loadMessages();
        this.closeModal();
      });
    }
  }

  deleteMessage(message: BroadcastMessage): void {
    if (confirm(`Delete message "${message.title}"?`)) {
      this.messageService.delete(message.id).subscribe(() => this.loadMessages());
    }
  }

  private toLocalDatetime(date: Date): string {
    return date.toISOString().slice(0, 16);
  }
}
