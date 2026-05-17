import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
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
import { createSimpleListResource } from '@shared/admin/simple-list-resource';
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
export class DevicesComponent {
  private readonly deviceService = inject(DeviceService);
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  // Status filter is bound to the <mat-select>; loadDevices() is called by
  // (selectionChange) so the resource re-fetches with the updated value.
  statusFilter: DeviceStatus | '' = '';

  private readonly devicesResource = createSimpleListResource<Device>(() =>
    this.deviceService.getAll(this.statusFilter || undefined),
  );
  readonly devices = this.devicesResource.items;
  readonly loading = this.devicesResource.loading;
  readonly loadError = computed(() => {
    const err = this.devicesResource.error();
    return err ? httpErrorMessage(err, this.transloco.translate('admin.devices.loadFailed')) : null;
  });

  private readonly linesSignal = signal<Line[]>([]);
  readonly lines = this.linesSignal.asReadonly();

  constructor() {
    this.lineService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lines) => this.linesSignal.set(lines),
      error: () => this.notify.error(this.transloco.translate('admin.devices.loadLinesFailed')),
    });
  }

  loadDevices(): void {
    this.devicesResource.reload();
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
