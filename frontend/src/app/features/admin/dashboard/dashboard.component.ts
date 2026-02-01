import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LineService } from '@core/api/line.service';
import { MessageService } from '@core/api/message.service';
import { DeviceService } from '@core/api/device.service';
import { Line, BroadcastMessage, Device } from '@shared/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 mb-6">Dashboard</h1>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="card p-6">
          <div class="text-3xl font-bold text-neutral-900">{{ lines().length }}</div>
          <div class="text-neutral-600">Lines</div>
        </div>

        <div class="card p-6">
          <div class="text-3xl font-bold text-neutral-900">{{ activeMessages().length }}</div>
          <div class="text-neutral-600">Active Messages</div>
        </div>

        <div class="card p-6">
          <div class="text-3xl font-bold text-neutral-900">
            {{ onlineDevices() }} / {{ devices().length }}
          </div>
          <div class="text-neutral-600">Devices Online</div>
        </div>
      </div>

      <!-- Alerts -->
      @if (criticalMessages().length > 0 || offlineDevices().length > 0) {
        <div class="card mb-8">
          <div class="px-6 py-4 border-b border-neutral-200">
            <h2 class="text-lg font-semibold text-neutral-900">Active Alerts</h2>
          </div>
          <div class="p-6">
            @for (message of criticalMessages(); track message.id) {
              <div class="flex items-center p-3 bg-red-50 border border-red-200 rounded-md mb-3 last:mb-0">
                <span class="text-critical mr-3">⚠️</span>
                <div>
                  <span class="font-medium text-critical">CRITICAL:</span>
                  {{ message.title }}
                </div>
              </div>
            }

            @for (device of offlineDevices(); track device.id) {
              <div class="flex items-center p-3 bg-orange-50 border border-orange-200 rounded-md mb-3 last:mb-0">
                <span class="text-warning mr-3">📺</span>
                <div>
                  Device at <span class="font-medium">{{ device.stopName }}</span> is offline
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Quick Links -->
      <div class="card">
        <div class="px-6 py-4 border-b border-neutral-200">
          <h2 class="text-lg font-semibold text-neutral-900">Quick Actions</h2>
        </div>
        <div class="p-6 flex gap-4">
          <a routerLink="/admin/messages" class="btn btn-primary">
            New Message
          </a>
          <a routerLink="/admin/lines" class="btn btn-secondary">
            Manage Lines
          </a>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  lines = signal<Line[]>([]);
  activeMessages = signal<BroadcastMessage[]>([]);
  devices = signal<Device[]>([]);

  criticalMessages = signal<BroadcastMessage[]>([]);
  offlineDevices = signal<Device[]>([]);

  constructor(
    private lineService: LineService,
    private messageService: MessageService,
    private deviceService: DeviceService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.lineService.getAll().subscribe(lines => this.lines.set(lines));

    this.messageService.getAll(true).subscribe(messages => {
      this.activeMessages.set(messages);
      this.criticalMessages.set(messages.filter(m => m.severity === 'CRITICAL'));
    });

    this.deviceService.getAll().subscribe(devices => {
      this.devices.set(devices);
      this.offlineDevices.set(devices.filter(d => d.status === 'OFFLINE'));
    });
  }

  onlineDevices(): number {
    return this.devices().filter(d => d.status === 'ONLINE').length;
  }
}
