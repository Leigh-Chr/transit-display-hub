import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  BroadcastMessage,
  Line,
  Stop,
  CreateMessageRequest,
  MessageSeverity,
  MessageScope,
} from '@shared/models';
import { StopService } from '@core/api/stop.service';

export interface MessageDialogData {
  message?: BroadcastMessage;
  lines: Line[];
}

interface MessageForm {
  title: string;
  content: string;
  severity: MessageSeverity;
  scopeType: MessageScope;
  lineId: string;
  stopId: string;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-message-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ data.message ? 'Edit Message' : 'New Broadcast Message' }}
    </h2>
    <mat-dialog-content>
      <form #messageForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Title</mat-label>
          <input
            matInput
            [(ngModel)]="form.title"
            name="title"
            placeholder="e.g., Service Disruption"
            required
          />
          <mat-error>Title is required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Content</mat-label>
          <textarea
            matInput
            [(ngModel)]="form.content"
            name="content"
            rows="3"
            placeholder="Detailed message content..."
            required
          ></textarea>
          <mat-error>Content is required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Severity</mat-label>
          <mat-select [(ngModel)]="form.severity" name="severity" required>
            <mat-option value="INFO">Info</mat-option>
            <mat-option value="WARNING">Warning</mat-option>
            <mat-option value="CRITICAL">Critical</mat-option>
          </mat-select>
          <mat-error>Severity is required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Scope</mat-label>
          <mat-select
            [(ngModel)]="form.scopeType"
            name="scopeType"
            required
            (selectionChange)="onScopeChange()"
          >
            <mat-option value="NETWORK">Entire Network</mat-option>
            <mat-option value="LINE">Specific Line</mat-option>
            <mat-option value="STOP">Specific Stop</mat-option>
          </mat-select>
          <mat-error>Scope is required</mat-error>
        </mat-form-field>

        @if (form.scopeType === 'LINE' || form.scopeType === 'STOP') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Line</mat-label>
            <mat-select
              [(ngModel)]="form.lineId"
              name="lineId"
              required
              (selectionChange)="onLineChange()"
            >
              @for (line of data.lines; track line.id) {
                <mat-option [value]="line.id">
                  {{ line.code }} - {{ line.name }}
                </mat-option>
              }
            </mat-select>
            <mat-error>Line is required for this scope</mat-error>
          </mat-form-field>
        }

        @if (form.scopeType === 'STOP') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Stop</mat-label>
            <mat-select
              [(ngModel)]="form.stopId"
              name="stopId"
              required
              [disabled]="!form.lineId"
            >
              @for (stop of stops(); track stop.id) {
                <mat-option [value]="stop.id">{{ stop.name }}</mat-option>
              }
            </mat-select>
            @if (!form.lineId) {
              <mat-hint>Pick a line first</mat-hint>
            }
            <mat-error>Stop is required for this scope</mat-error>
          </mat-form-field>
        }

        <div class="datetime-row">
          <mat-form-field appearance="outline">
            <mat-label>Start Time</mat-label>
            <input
              matInput
              type="datetime-local"
              [(ngModel)]="form.startTime"
              name="startTime"
              required
            />
            <mat-error>Start time is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>End Time</mat-label>
            <input
              matInput
              type="datetime-local"
              [(ngModel)]="form.endTime"
              name="endTime"
              required
            />
            @if (form.startTime && form.endTime && !isDateRangeValid()) {
              <mat-error>End time must be after start time</mat-error>
            } @else {
              <mat-error>End time is required</mat-error>
            }
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!messageForm.valid || !isDateRangeValid()"
        (click)="save()"
      >
        {{ data.message ? 'Save Changes' : 'Create Message' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: var(--app-dialog-min-width-lg);
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }

    .datetime-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .datetime-row mat-form-field {
      width: 100%;
    }
  `,
})
export class MessageDialogComponent implements OnInit {
  private readonly stopService = inject(StopService);
  readonly dialogRef = inject(MatDialogRef<MessageDialogComponent>);
  readonly data = inject<MessageDialogData>(MAT_DIALOG_DATA);

  stops = signal<Stop[]>([]);

  form: MessageForm = this.initForm();

  ngOnInit(): void {
    if (this.form.lineId && this.form.scopeType === 'STOP') {
      this.loadStops();
    }
  }

  private initForm(): MessageForm {
    const message = this.data.message;
    if (message) {
      return {
        title: message.title,
        content: message.content,
        severity: message.severity,
        scopeType: message.scopeType,
        lineId: message.scopeType === 'LINE' ? message.scopeId ?? '' : '',
        stopId: message.scopeType === 'STOP' ? message.scopeId ?? '' : '',
        startTime: this.toLocalDatetime(new Date(message.startTime)),
        endTime: this.toLocalDatetime(new Date(message.endTime)),
      };
    }

    const now = new Date();
    const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return {
      title: '',
      content: '',
      severity: 'INFO',
      scopeType: 'NETWORK',
      lineId: '',
      stopId: '',
      startTime: this.toLocalDatetime(now),
      endTime: this.toLocalDatetime(later),
    };
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
      this.loadStops();
    } else {
      this.stops.set([]);
    }
  }

  private loadStops(): void {
    this.stopService.getAll(this.form.lineId).subscribe({
      next: (stops) => this.stops.set(stops),
      error: () => this.stops.set([]),
    });
  }

  isDateRangeValid(): boolean {
    if (!this.form.startTime || !this.form.endTime) {return true;}
    return new Date(this.form.endTime) > new Date(this.form.startTime);
  }

  save(): void {
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
      endTime: new Date(this.form.endTime).toISOString(),
    };

    this.dialogRef.close(request);
  }

  private toLocalDatetime(date: Date): string {
    return date.toISOString().slice(0, 16);
  }
}
