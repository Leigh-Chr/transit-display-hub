import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LineService } from '@core/api/line.service';
import { MessageService } from '@core/api/message.service';
import { Line, BroadcastMessage } from '@shared/models';
import { MessageDialogComponent, MessageDialogData } from './message-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { listStagger } from '@shared/animations';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    CardSkeletonComponent,
    EmptyStateComponent,
  ],
  animations: [listStagger],
  template: `
    <div class="messages-page">
      <div class="page-header">
        <h1 class="page-title">Broadcast Messages</h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          New Message
        </button>
      </div>

      <div class="filter-row">
        <mat-checkbox [(ngModel)]="showActiveOnly" (change)="loadMessages()">
          Active only
        </mat-checkbox>
      </div>

      @if (loading()) {
        <div class="messages-list">
          @for (i of [1, 2, 3]; track i) {
            <app-card-skeleton [showIcon]="true" />
          }
        </div>
      } @else if (messages().length === 0) {
        <mat-card>
          <app-empty-state
            icon="campaign"
            iconColor="primary"
            title="No messages found"
            description="Create broadcast messages to notify passengers across your transit network."
            actionLabel="Create Message"
            actionIcon="add"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else {
        <div class="messages-list" [@listStagger]="messages().length">
          @for (message of messages(); track message.id) {
            <mat-card class="message-card">
              <div class="message-content">
                <div
                  class="severity-icon"
                  [class.critical]="message.severity === 'CRITICAL'"
                  [class.warning]="message.severity === 'WARNING'"
                  [class.info]="message.severity === 'INFO'"
                >
                  @switch (message.severity) {
                    @case ('CRITICAL') {
                      <mat-icon>error</mat-icon>
                    }
                    @case ('WARNING') {
                      <mat-icon>warning</mat-icon>
                    }
                    @default {
                      <mat-icon>info</mat-icon>
                    }
                  }
                </div>

                <div class="message-body">
                  <div class="message-header">
                    <h3 class="message-title">{{ message.title }}</h3>
                    <div class="badges">
                      <span
                        class="badge"
                        [class.badge-critical]="message.severity === 'CRITICAL'"
                        [class.badge-warning]="message.severity === 'WARNING'"
                        [class.badge-info]="message.severity === 'INFO'"
                      >
                        {{ message.severity }}
                      </span>
                      @if (isActive(message)) {
                        <span class="badge badge-active">ACTIVE</span>
                      } @else {
                        <span class="badge badge-inactive">INACTIVE</span>
                      }
                    </div>
                  </div>
                  <p class="message-text">{{ message.content }}</p>
                  <div class="message-meta">
                    <span class="meta-label">Scope:</span>
                    @switch (message.scopeType) {
                      @case ('NETWORK') {
                        <span>Entire Network</span>
                      }
                      @case ('LINE') {
                        <span>Line: {{ message.scopeInfo?.name }}</span>
                      }
                      @case ('STOP') {
                        <span>Stop: {{ message.scopeInfo?.name }}</span>
                      }
                    }
                    <span class="meta-separator hide-mobile">|</span>
                    <span class="hide-mobile">
                      {{ message.startTime | date : 'short' }} -
                      {{ message.endTime | date : 'short' }}
                    </span>
                  </div>
                </div>

                <div class="message-actions">
                  <button mat-icon-button color="primary" (click)="openEditDialog(message)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteMessage(message)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }

    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--app-on-surface);
      margin: 0;
      letter-spacing: -0.5px;
    }

    .filter-row {
      margin-bottom: 20px;
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .message-card {
      padding: 20px;
      border-radius: 12px;
    }

    .message-content {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .severity-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .severity-icon mat-icon {
      color: white;
    }

    .severity-icon.critical {
      background-color: var(--app-critical);
    }

    .severity-icon.warning {
      background-color: var(--app-warning);
    }

    .severity-icon.info {
      background-color: var(--app-info);
    }

    .message-body {
      flex: 1;
      min-width: 0;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .message-title {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: var(--app-on-surface);
    }

    .message-text {
      color: var(--app-on-surface-variant);
      margin: 0 0 10px;
      line-height: 1.5;
    }

    .message-meta {
      font-size: 13px;
      color: var(--app-on-surface-muted);
    }

    .meta-label {
      font-weight: 600;
    }

    .meta-separator {
      margin: 0 10px;
      opacity: 0.5;
    }

    .message-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-critical {
      background-color: var(--app-critical-container);
      color: var(--app-on-critical-container);
    }

    .badge-warning {
      background-color: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }

    .badge-info {
      background-color: var(--app-info-container);
      color: var(--app-on-info-container);
    }

    .badge-active {
      background-color: var(--app-success-container);
      color: var(--app-on-success-container);
    }

    .badge-inactive {
      background-color: var(--app-surface-container-high);
      color: var(--app-on-surface-variant);
    }

    .hide-mobile {
      @media (max-width: 600px) {
        display: none !important;
      }
    }

    @media (max-width: 600px) {
      .message-content {
        flex-wrap: wrap;
      }

      .message-actions {
        width: 100%;
        justify-content: flex-end;
        margin-top: 12px;
      }
    }
  `,
})
export class MessagesComponent implements OnInit {
  private readonly messageService = inject(MessageService);
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  loading = signal(true);
  messages = signal<BroadcastMessage[]>([]);
  lines = signal<Line[]>([]);
  showActiveOnly = true;

  ngOnInit(): void {
    this.loadMessages();
    this.lineService.getAll().subscribe((lines) => this.lines.set(lines));
  }

  loadMessages(): void {
    this.loading.set(true);
    this.messageService.getAll(this.showActiveOnly).subscribe({
      next: (messages) => {
        this.messages.set(messages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  isActive(message: BroadcastMessage): boolean {
    const now = new Date();
    return new Date(message.startTime) <= now && now <= new Date(message.endTime);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(MessageDialogComponent, {
      data: { lines: this.lines() } as MessageDialogData,
      width: '500px',
      ariaLabel: 'Create new broadcast message',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.messageService.create(result).subscribe(() => {
          this.loadMessages();
          this.snackBar.open('Message created', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }

  openEditDialog(message: BroadcastMessage): void {
    const dialogRef = this.dialog.open(MessageDialogComponent, {
      data: { message, lines: this.lines() } as MessageDialogData,
      width: '500px',
      ariaLabel: `Edit message ${message.title}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.messageService.update(message.id, result).subscribe(() => {
          this.loadMessages();
          this.snackBar.open('Message updated', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }

  deleteMessage(message: BroadcastMessage): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Message',
        message: `Delete message "${message.title}"?`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of message ${message.title}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.messageService.delete(message.id).subscribe(() => {
          this.loadMessages();
          this.snackBar.open('Message deleted', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        });
      }
    });
  }
}
