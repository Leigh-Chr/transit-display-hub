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
import { NotifyService } from '@core/services/notify.service';
import { LineService } from '@core/api/line.service';
import { DeviceService } from '@core/api/device.service';
import { Line, Device, DeviceStatus, DeviceRegistration, RegisterDeviceRequest } from '@shared/models';
import { DeviceDialogComponent } from './device-dialog.component';
import { DeviceTokenDialogComponent } from './device-token-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { httpErrorMessage } from '@shared/utils/http.utils';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

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
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <div class="devices-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.devices.title') }}</h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          {{ t('admin.devices.registerDevice') }}
        </button>
      </div>

      <mat-form-field appearance="outline" class="status-filter">
        <mat-label>{{ t('admin.devices.filterStatus') }}</mat-label>
        <mat-select [(ngModel)]="statusFilter" (selectionChange)="loadDevices()">
          <mat-option value="">{{ t('admin.devices.allStatuses') }}</mat-option>
          <mat-option value="ONLINE">{{ t('admin.devices.statusOnline') }}</mat-option>
          <mat-option value="OFFLINE">{{ t('admin.devices.statusOffline') }}</mat-option>
        </mat-select>
      </mat-form-field>

      @if (loading()) {
        <div class="devices-grid">
          @for (i of [1, 2, 3]; track i) {
            <app-card-skeleton [showIcon]="true" />
          }
        </div>
      } @else if (loadError()) {
        <mat-card>
          <app-empty-state
            icon="error_outline"
            [title]="t('admin.devices.loadFailed')"
            [description]="t('admin.common.loadErrorDescription')"
            [actionLabel]="t('common.refresh')"
            actionIcon="refresh"
            (action)="loadDevices()"
          />
        </mat-card>
      } @else if (devices().length === 0) {
        <mat-card>
          <app-empty-state
            icon="tv"
            iconColor="primary"
            [title]="t('admin.devices.emptyTitle')"
            [description]="t('admin.devices.emptyDescription')"
            [actionLabel]="t('admin.devices.emptyAction')"
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
                    {{ device.status === 'ONLINE' ? t('admin.devices.statusOnline') : t('admin.devices.statusOffline') }}
                  </span>
                </div>

                <div class="device-meta">
                  @if (device.lastHeartbeat) {
                    <div class="meta-item">
                      <span class="meta-label">{{ t('admin.devices.lastSeen') }}</span>
                      {{ device.lastHeartbeat | date : 'short' }}
                    </div>
                  }
                </div>
              </mat-card-content>

              <mat-card-actions align="end">
                <button mat-button (click)="openKioskPreview(device.stopId)">
                  <mat-icon>visibility</mat-icon>
                  {{ t('admin.devices.viewDisplay') }}
                </button>
                <button mat-button color="warn" (click)="deleteDevice(device)">
                  <mat-icon>delete</mat-icon>
                  {{ t('admin.devices.removeDevice') }}
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </div>

    </ng-container>
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

    /* Enter animations defined globally — see styles.scss section 13a */
  `,
})
export class DevicesComponent implements OnInit {
  private readonly deviceService = inject(DeviceService);
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  devices = signal<Device[]>([]);
  lines = signal<Line[]>([]);
  statusFilter: DeviceStatus | '' = '';

  ngOnInit(): void {
    this.loadDevices();
    this.lineService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lines) => this.lines.set(lines),
      error: () => this.notify.error(this.transloco.translate('admin.devices.loadLinesFailed')),
    });
  }

  loadDevices(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const status = this.statusFilter || undefined;
    this.deviceService.getAll(status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (devices) => {
        this.devices.set(devices);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(httpErrorMessage(err, this.transloco.translate('admin.devices.loadFailed')));
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(DeviceDialogComponent, {
      data: {
        lines: this.lines(),
        submit: (request: RegisterDeviceRequest) => this.deviceService.register(request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.devices.registerFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.devices.dialog.title'),
    });

    dialogRef.afterClosed().subscribe((registration: DeviceRegistration | undefined) => {
      if (registration) {
        this.loadDevices();
        this.dialog.open(DeviceTokenDialogComponent, {
          data: { token: registration.token },
          disableClose: false,
          autoFocus: '[data-copy-button]',
          ariaLabel: this.transloco.translate('admin.devices.tokenTitle'),
        });
      }
    });
  }

  deleteDevice(device: Device): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.transloco.translate('admin.devices.confirm.removeTitle'),
        message: this.transloco.translate('admin.devices.confirm.removeMessage', { stopName: device.stopName }),
        confirmText: this.transloco.translate('admin.common.remove'),
        cancelText: this.transloco.translate('common.cancel'),
        confirmColor: 'warn',
      },
      ariaLabel: this.transloco.translate('admin.devices.confirm.removeTitle'),
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deviceService.delete(device.id).subscribe({
          next: () => {
            this.loadDevices();
            this.notify.success(this.transloco.translate('admin.devices.removeSuccess'));
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.devices.removeFailed')));
          },
        });
      }
    });
  }

  openKioskPreview(stopId: string): void {
    window.open(`/display/${stopId}`, '_blank');
  }
}
