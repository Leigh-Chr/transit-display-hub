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
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { confirmAndDelete } from '@shared/admin/confirm-and-delete';
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
  templateUrl: './devices.component.html',
  styleUrl: './devices.component.scss',
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
    confirmAndDelete(
      { dialog: this.dialog, transloco: this.transloco, notify: this.notify },
      {
        titleKey: 'admin.devices.confirm.removeTitle',
        messageKey: 'admin.devices.confirm.removeMessage',
        messageArgs: { stopName: device.stopName },
        confirmKey: 'admin.common.remove',
        successKey: 'admin.devices.removeSuccess',
        errorKey: 'admin.devices.removeFailed',
        delete$: () => this.deviceService.delete(device.id),
        onSuccess: () => this.loadDevices(),
      },
    );
  }

  openKioskPreview(stopId: string): void {
    window.open(`/display/${stopId}`, '_blank');
  }
}
