import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { DeviceService } from '@core/api/device.service';
import { Line, Stop, Device, DeviceStatus } from '@shared/models';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-neutral-900">Devices</h1>
        <button (click)="openCreateModal()" class="btn btn-primary">
          + Register Device
        </button>
      </div>

      <!-- Status Filter -->
      <div class="mb-4">
        <select [(ngModel)]="statusFilter" (ngModelChange)="loadDevices()" class="input w-48">
          <option value="">All Statuses</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
        </select>
      </div>

      <!-- Devices Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (device of devices(); track device.id) {
          <div class="card p-4">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-2xl">📺</span>
                <div>
                  <h3 class="font-semibold text-neutral-900">{{ device.stopName }}</h3>
                  <span class="inline-block px-2 py-0.5 rounded-full bg-neutral-600 text-white text-xs">
                    {{ device.lineCode }}
                  </span>
                </div>
              </div>
              <div
                class="px-2 py-1 rounded text-xs font-medium"
                [class.bg-green-100]="device.status === 'ONLINE'"
                [class.text-green-700]="device.status === 'ONLINE'"
                [class.bg-red-100]="device.status === 'OFFLINE'"
                [class.text-red-700]="device.status === 'OFFLINE'">
                {{ device.status }}
              </div>
            </div>

            <div class="text-sm text-neutral-500 space-y-1">
              @if (device.lastHeartbeat) {
                <div>Last seen: {{ device.lastHeartbeat | date:'short' }}</div>
              }
              <div class="font-mono text-xs bg-neutral-50 p-2 rounded break-all">
                ID: {{ device.id.substring(0, 20) }}...
              </div>
            </div>

            <div class="flex gap-2 mt-4 pt-3 border-t border-neutral-100">
              <button
                (click)="deleteDevice(device)"
                class="flex-1 text-sm text-red-600 hover:text-red-800">
                Remove
              </button>
            </div>
          </div>
        } @empty {
          <div class="col-span-full card p-8 text-center text-neutral-500">
            No devices registered. Register a device to connect displays.
          </div>
        }
      </div>

      <!-- Register Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div class="px-6 py-4 border-b border-neutral-200">
              <h2 class="text-lg font-semibold text-neutral-900">Register New Device</h2>
            </div>
            <form (ngSubmit)="registerDevice()" class="p-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Line</label>
                  <select
                    [(ngModel)]="form.lineId"
                    name="lineId"
                    class="input"
                    required
                    (ngModelChange)="onLineChange()">
                    <option value="">Select a line</option>
                    @for (line of lines(); track line.id) {
                      <option [value]="line.id">{{ line.code }} - {{ line.name }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Stop</label>
                  <select
                    [(ngModel)]="form.stopId"
                    name="stopId"
                    class="input"
                    required
                    [disabled]="!form.lineId">
                    <option value="">Select a stop</option>
                    @for (stop of stops(); track stop.id) {
                      <option [value]="stop.id">{{ stop.name }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="flex justify-end gap-3 mt-6">
                <button type="button" (click)="closeModal()" class="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Token Display Modal -->
      @if (newDeviceToken()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div class="px-6 py-4 border-b border-neutral-200">
              <h2 class="text-lg font-semibold text-neutral-900">Device Registered</h2>
            </div>
            <div class="p-6">
              <p class="text-neutral-600 mb-4">
                Copy this token and configure it on your display device. This token is shown only once.
              </p>
              <div class="bg-neutral-50 p-4 rounded-lg">
                <div class="font-mono text-sm break-all select-all">{{ newDeviceToken() }}</div>
              </div>
              <div class="mt-4">
                <button (click)="copyNewToken()" class="btn btn-primary w-full">
                  Copy Token to Clipboard
                </button>
              </div>
            </div>
            <div class="px-6 py-4 border-t border-neutral-200">
              <button (click)="closeTokenModal()" class="btn btn-secondary w-full">
                Done
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class DevicesComponent implements OnInit {
  devices = signal<Device[]>([]);
  lines = signal<Line[]>([]);
  stops = signal<Stop[]>([]);
  showModal = signal(false);
  newDeviceToken = signal<string | null>(null);
  statusFilter: DeviceStatus | '' = '';

  form = {
    stopId: '',
    lineId: ''  // Used for UI only - to filter stops by line
  };

  constructor(
    private deviceService: DeviceService,
    private lineService: LineService,
    private stopService: StopService
  ) {}

  ngOnInit(): void {
    this.loadDevices();
    this.lineService.getAll().subscribe(lines => this.lines.set(lines));
  }

  loadDevices(): void {
    const status = this.statusFilter || undefined;
    this.deviceService.getAll(status).subscribe(devices => this.devices.set(devices));
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
    this.form = { stopId: '', lineId: '' };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  registerDevice(): void {
    this.deviceService.register({ stopId: this.form.stopId }).subscribe(registration => {
      this.newDeviceToken.set(registration.token);
      this.loadDevices();
      this.closeModal();
    });
  }

  closeTokenModal(): void {
    this.newDeviceToken.set(null);
  }

  copyNewToken(): void {
    const token = this.newDeviceToken();
    if (token) {
      navigator.clipboard.writeText(token).then(() => {
        alert('Token copied to clipboard');
      });
    }
  }

  deleteDevice(device: Device): void {
    if (confirm(`Remove device at "${device.stopName}"?`)) {
      this.deviceService.delete(device.id).subscribe(() => this.loadDevices());
    }
  }
}
