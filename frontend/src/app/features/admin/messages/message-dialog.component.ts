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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import {
  BroadcastMessage,
  Line,
  Stop,
  CreateMessageRequest,
  MessageSeverity,
  MessageScope,
} from '@shared/models';
import { StopService } from '@core/api/stop.service';
import { TranslocoDirective } from '@jsverse/transloco';
import { runDialogSubmit } from '@shared/admin/dialog-submit';

export interface MessageDialogData {
  message?: BroadcastMessage;
  lines: Line[];
  submit: (request: CreateMessageRequest) => Observable<BroadcastMessage>;
  onError?: (err: unknown) => void;
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
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <h2 mat-dialog-title>
      {{ data.message ? t('admin.messages.dialog.titleEdit') : t('admin.messages.dialog.titleCreate') }}
    </h2>
    <mat-dialog-content>
      <form #messageForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.messages.dialog.fieldTitle') }}</mat-label>
          <input
            matInput
            [(ngModel)]="form.title"
            name="title"
            [placeholder]="t('admin.messages.dialog.fieldTitlePlaceholder')"
            required
          />
          <mat-error>{{ t('admin.messages.dialog.fieldTitleRequired') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.messages.dialog.fieldContent') }}</mat-label>
          <textarea
            matInput
            [(ngModel)]="form.content"
            name="content"
            rows="3"
            [placeholder]="t('admin.messages.dialog.fieldContentPlaceholder')"
            required
          ></textarea>
          <mat-error>{{ t('admin.messages.dialog.fieldContentRequired') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.messages.dialog.fieldSeverity') }}</mat-label>
          <mat-select [(ngModel)]="form.severity" name="severity" required>
            <mat-option value="INFO">{{ t('admin.messages.severityInfo') }}</mat-option>
            <mat-option value="WARNING">{{ t('admin.messages.severityWarning') }}</mat-option>
            <mat-option value="CRITICAL">{{ t('admin.messages.severityCritical') }}</mat-option>
          </mat-select>
          <mat-error>{{ t('admin.messages.dialog.fieldSeverityRequired') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.messages.dialog.fieldScope') }}</mat-label>
          <mat-select
            [(ngModel)]="form.scopeType"
            name="scopeType"
            required
            (selectionChange)="onScopeChange()"
          >
            <mat-option value="NETWORK">{{ t('admin.messages.dialog.scopeNetwork') }}</mat-option>
            <mat-option value="LINE">{{ t('admin.messages.dialog.scopeLine') }}</mat-option>
            <mat-option value="STOP">{{ t('admin.messages.dialog.scopeStop') }}</mat-option>
          </mat-select>
          <mat-error>{{ t('admin.messages.dialog.fieldScopeRequired') }}</mat-error>
        </mat-form-field>

        @if (form.scopeType === 'LINE' || form.scopeType === 'STOP') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ t('admin.messages.dialog.fieldLine') }}</mat-label>
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
            <mat-error>{{ t('admin.messages.dialog.fieldLineRequired') }}</mat-error>
          </mat-form-field>
        }

        @if (form.scopeType === 'STOP') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ t('admin.messages.dialog.fieldStop') }}</mat-label>
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
              <mat-hint>{{ t('admin.messages.dialog.fieldStopHint') }}</mat-hint>
            }
            <mat-error>{{ t('admin.messages.dialog.fieldStopRequired') }}</mat-error>
          </mat-form-field>
        }

        <div class="datetime-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ t('admin.messages.dialog.fieldStartTime') }}</mat-label>
            <input
              matInput
              type="datetime-local"
              [(ngModel)]="form.startTime"
              name="startTime"
              required
            />
            <mat-error>{{ t('admin.messages.dialog.fieldStartTimeRequired') }}</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ t('admin.messages.dialog.fieldEndTime') }}</mat-label>
            <input
              matInput
              type="datetime-local"
              [(ngModel)]="form.endTime"
              name="endTime"
              required
            />
            @if (form.startTime && form.endTime && !isDateRangeValid()) {
              <mat-error>{{ t('admin.messages.dialog.fieldEndTimeInvalid') }}</mat-error>
            } @else {
              <mat-error>{{ t('admin.messages.dialog.fieldEndTimeRequired') }}</mat-error>
            }
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="submitting()">{{ t('common.cancel') }}</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!messageForm.valid || !isDateRangeValid() || submitting()"
        (click)="save()"
      >
        @if (submitting()) {
          <mat-progress-spinner mode="indeterminate" diameter="18" />
        }
        {{ data.message ? t('admin.messages.dialog.actionSave') : t('admin.messages.dialog.actionCreate') }}
      </button>
    </mat-dialog-actions>
    </ng-container>
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
  readonly submitting = signal(false);

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

    runDialogSubmit(this.submitting, () => this.data.submit(request), this.dialogRef, this.data.onError);
  }

  private toLocalDatetime(date: Date): string {
    return date.toISOString().slice(0, 16);
  }
}
