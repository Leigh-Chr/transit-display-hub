import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { DeviceService } from '@core/api/device.service';
import { Device, DeviceStatus, DeviceRegistration, RegisterDeviceRequest } from '@shared/models';
import { DeviceDialogComponent } from './device-dialog.component';
import { DeviceTokenDialogComponent } from './device-token-dialog.component';
import { AdminPageHeaderComponent } from '@shared/components/admin-page-header/admin-page-header.component';
import { LineBadgeComponent } from '@shared/components/line-badge/line-badge.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { confirmAndDelete } from '@shared/admin/confirm-and-delete';
import { createSimpleListResource } from '@shared/admin/simple-list-resource';
import { useLinesResource } from '@shared/admin/use-lines-resource';
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
    AdminPageHeaderComponent,
    LineBadgeComponent,
    StatusBadgeComponent,
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
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly queryParams = toSignal(this.route.queryParams, { initialValue: {} });

  // Status filter is mirrored into the URL ?status=ONLINE|OFFLINE so the
  // page is deep-linkable and persists across refreshes — matches the
  // createAdminListResource pattern used elsewhere without dragging the
  // full pagination/sort machinery into a card-based view.
  readonly statusFilter = signal<DeviceStatus | ''>(this.readStatusParam());

  constructor() {
    // URL → signal (browser nav, deep link).
    effect(() => {
      const params = this.queryParams() as { status?: string };
      const fromUrl = this.normaliseStatus(params.status);
      if (fromUrl !== this.statusFilter()) {
        this.statusFilter.set(fromUrl);
      }
    });
  }

  private readonly devicesResource = createSimpleListResource<Device>(() =>
    this.deviceService.getAll(this.statusFilter() || undefined),
  );
  readonly devices = this.devicesResource.items;
  readonly loading = this.devicesResource.loading;
  readonly loadError = computed(() => {
    const err = this.devicesResource.error();
    return err ? httpErrorMessage(err, this.transloco.translate('admin.devices.loadFailed')) : null;
  });

  readonly lines = useLinesResource('admin.devices');

  loadDevices(): void {
    this.devicesResource.reload();
  }

  onStatusChange(value: DeviceStatus | ''): void {
    this.statusFilter.set(value);
    // signal → URL (so a bookmark / share preserves the filter). Reload
    // is implicit through the queryParams effect picking the change
    // back up + createSimpleListResource recomputing its loader closure
    // on the next reload() — fired here too in case the URL did not
    // actually change (same value re-applied).
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: value || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.devicesResource.reload();
  }

  private readStatusParam(): DeviceStatus | '' {
    const raw = this.route.snapshot.queryParamMap.get('status');
    return this.normaliseStatus(raw);
  }

  private normaliseStatus(raw: string | null | undefined): DeviceStatus | '' {
    if (raw === 'ONLINE' || raw === 'OFFLINE') {
      return raw;
    }
    return '';
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
