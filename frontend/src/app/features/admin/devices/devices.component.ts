import { ChangeDetectionStrategy, Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LineService } from '@core/api/line.service';
import { DeviceService } from '@core/api/device.service';
import { Line, Device, DeviceStatus, RegisterDeviceRequest } from '@shared/models';
import { DeviceDialogComponent } from './device-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { httpErrorMessage } from '@shared/utils/http.utils';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    CardSkeletonComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="devices-page">
      <div class="page-header">
        <h1 class="page-title">Devices</h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          Register Device
        </button>
      </div>

      <mat-form-field appearance="outline" class="status-filter">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="statusFilter" (selectionChange)="loadDevices()">
          <mat-option value="">All Statuses</mat-option>
          <mat-option value="ONLINE">Online</mat-option>
          <mat-option value="OFFLINE">Offline</mat-option>
        </mat-select>
      </mat-form-field>

      @if (loading()) {
        <div class="devices-grid">
          @for (i of [1, 2, 3]; track i) {
            <app-card-skeleton [showIcon]="true" />
          }
        </div>
      } @else if (devices().length === 0) {
        <mat-card>
          <app-empty-state
            icon="tv"
            iconColor="primary"
            title="No devices registered"
            description="Register a device to connect your transit displays."
            actionLabel="Register Device"
            actionIcon="add"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else {
        <div class="devices-grid" animate.enter="grid-stagger">
          @for (device of devices(); track device.id) {
            <mat-card class="device-card">
              <mat-card-content>
                <div class="device-header">
                  <div class="device-info">
                    <mat-icon class="device-icon">tv</mat-icon>
                    <div>
                      <h3 class="device-stop">{{ device.stopName }}</h3>
                      <div class="line-badges">
                        @for (line of device.lines; track line.code) {
                          <span class="line-badge" [style.backgroundColor]="line.color">
                            {{ line.code }}
                          </span>
                        }
                      </div>
                    </div>
                  </div>
                  <span
                    class="status-badge"
                    [class.status-online]="device.status === 'ONLINE'"
                    [class.status-offline]="device.status === 'OFFLINE'"
                  >
                    {{ device.status }}
                  </span>
                </div>

                <div class="device-meta">
                  @if (device.lastHeartbeat) {
                    <div class="meta-item">
                      <span class="meta-label">Last seen:</span>
                      {{ device.lastHeartbeat | date : 'short' }}
                    </div>
                  }
                </div>
              </mat-card-content>

              <mat-card-actions align="end">
                <button mat-button (click)="openKioskPreview(device.stopId)">
                  <mat-icon>visibility</mat-icon>
                  View Display
                </button>
                <button mat-button color="warn" (click)="deleteDevice(device)">
                  <mat-icon>delete</mat-icon>
                  Remove
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </div>

    @if (newDeviceToken()) {
      <div class="token-overlay">
        <mat-card class="token-card">
          <mat-card-header>
            <mat-card-title>Device Registered</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="token-instructions">
              Copy this token and configure it on your display device.
              This token is shown only once.
            </p>
            <div class="token-display">
              {{ newDeviceToken() }}
            </div>
            <button
              mat-flat-button
              color="primary"
              class="full-width"
              (click)="copyToken()"
            >
              <mat-icon>content_copy</mat-icon>
              Copy Token to Clipboard
            </button>
          </mat-card-content>
          <mat-card-actions>
            <button mat-stroked-button class="full-width" (click)="closeTokenModal()">
              Done
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    }
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

    .status-filter {
      margin-bottom: 20px;
      width: 220px;
    }

    .devices-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--app-gap-grid);
    }

    .device-card {
      display: flex;
      flex-direction: column;
      border-radius: var(--app-radius-md);
    }

    .device-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .device-info {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }

    .device-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--app-on-surface-variant);
    }

    .device-stop {
      margin: 0 0 6px;
      font-size: 17px;
      font-weight: 600;
      color: var(--app-on-surface);
    }

    .line-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .line-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: var(--app-line-badge-radius);
      color: white;
      font-size: 12px;
      font-weight: 600;
    }

    .status-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: var(--app-line-badge-radius);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-online {
      background-color: var(--app-success-container);
      color: var(--app-on-success-container);
    }

    .status-offline {
      background-color: var(--app-critical-container);
      color: var(--app-on-critical-container);
    }

    .device-meta {
      font-size: 14px;
      color: var(--app-on-surface-variant);
    }

    .meta-item {
      margin-bottom: 6px;
    }

    .meta-label {
      font-weight: 600;
    }

    .token-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .token-card {
      width: 100%;
      max-width: 480px;
      margin: 16px;
      border-radius: var(--app-radius-lg);
    }

    .token-instructions {
      color: var(--app-on-surface-variant);
      margin-bottom: 20px;
      line-height: 1.5;
    }

    .token-display {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 13px;
      background-color: var(--app-surface-variant);
      padding: 16px;
      border-radius: var(--app-radius-sm);
      word-break: break-all;
      margin-bottom: 20px;
      user-select: all;
      border: 1px solid var(--app-outline);
    }

    .full-width {
      width: 100%;
    }

    /* Enter animations defined globally — see styles.scss section 13a */
  `,
})
export class DevicesComponent implements OnInit {
  private readonly deviceService = inject(DeviceService);
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  loading = signal(true);
  devices = signal<Device[]>([]);
  lines = signal<Line[]>([]);
  newDeviceToken = signal<string | null>(null);
  statusFilter: DeviceStatus | '' = '';

  ngOnInit(): void {
    this.loadDevices();
    this.lineService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lines) => this.lines.set(lines),
      error: () => this.snackBar.open('Failed to load lines', 'Close', { duration: 5000, panelClass: 'error-snackbar' }),
    });
  }

  loadDevices(): void {
    this.loading.set(true);
    const status = this.statusFilter || undefined;
    this.deviceService.getAll(status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (devices) => {
        this.devices.set(devices);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const message = httpErrorMessage(err, 'Failed to load devices');
        this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(DeviceDialogComponent, {
      data: { lines: this.lines() },
      width: '450px',
      ariaLabel: 'Register new device',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.deviceService.register(result as RegisterDeviceRequest).subscribe({
          next: (registration) => {
            this.newDeviceToken.set(registration.token);
            this.loadDevices();
          },
          error: (err: unknown) => {
            const message = httpErrorMessage(err, 'Failed to register device');
            this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
          },
        });
      }
    });
  }

  closeTokenModal(): void {
    this.newDeviceToken.set(null);
  }

  copyToken(): void {
    const token = this.newDeviceToken();
    if (token) {
      navigator.clipboard.writeText(token).then(
        () => {
          this.snackBar.open('Token copied to clipboard', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
        },
        () => {
          this.snackBar.open('Failed to copy token', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
        }
      );
    }
  }

  deleteDevice(device: Device): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Remove Device',
        message: `Remove device at "${device.stopName}"?`,
        confirmText: 'Remove',
        confirmColor: 'warn',
      },
      ariaLabel: `Confirm removal of device at ${device.stopName}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deviceService.delete(device.id).subscribe({
          next: () => {
            this.loadDevices();
            this.snackBar.open('Device removed', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const message = httpErrorMessage(err, 'Failed to remove device');
            this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
          },
        });
      }
    });
  }

  openKioskPreview(stopId: string): void {
    window.open(`/display/${stopId}`, '_blank');
  }
}
