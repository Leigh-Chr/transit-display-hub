import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { LineService } from '@core/api/line.service';
import { MessageService } from '@core/api/message.service';
import { DeviceService } from '@core/api/device.service';
import { Line, BroadcastMessage, Device } from '@shared/models';
import { StatsSkeletonComponent } from '@shared/components/skeleton/stats-skeleton.component';
import { gridStagger, fadeIn } from '@shared/animations';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    StatsSkeletonComponent,
  ],
  animations: [gridStagger, fadeIn],
  template: `
    <div class="dashboard">
      <h1 class="page-title">Dashboard</h1>

      @if (loading()) {
        <app-stats-skeleton />
      } @else {
        <div class="stats-grid" [@gridStagger]="3">
          <mat-card>
            <mat-card-content class="stat-card">
              <div class="stat-value">{{ lines().length }}</div>
              <div class="stat-label">Lines</div>
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-content class="stat-card">
              <div class="stat-value">{{ activeMessages().length }}</div>
              <div class="stat-label">Active Messages</div>
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-content class="stat-card">
              <div class="stat-value">
                {{ onlineDevices() }} / {{ devices().length }}
              </div>
              <div class="stat-label">Devices Online</div>
            </mat-card-content>
          </mat-card>
        </div>
      }

      @if (!loading() && (criticalMessages().length > 0 || offlineDevices().length > 0)) {
        <mat-card class="alerts-card" @fadeIn>
          <mat-card-header>
            <mat-card-title>Active Alerts</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @for (message of criticalMessages(); track message.id) {
              <div class="alert alert-critical">
                <mat-icon class="alert-icon">warning</mat-icon>
                <div>
                  <span class="alert-badge">CRITICAL:</span>
                  {{ message.title }}
                </div>
              </div>
            }

            @for (device of offlineDevices(); track device.id) {
              <div class="alert alert-warning">
                <mat-icon class="alert-icon">tv_off</mat-icon>
                <div>
                  Device at <span class="font-medium">{{ device.stopName }}</span> is offline
                </div>
              </div>
            }
          </mat-card-content>
        </mat-card>
      }

      <mat-card class="quick-actions-card" @fadeIn>
        <mat-card-header>
          <mat-card-title>Quick Actions</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="actions-row">
            <a mat-flat-button color="primary" routerLink="/admin/messages">
              <mat-icon>add</mat-icon>
              New Message
            </a>
            <a mat-stroked-button color="primary" routerLink="/admin/lines">
              <mat-icon>subway</mat-icon>
              Manage Lines
            </a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--app-on-surface);
      margin-bottom: 28px;
      letter-spacing: -0.5px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 24px;
      margin-bottom: 28px;
    }

    .stat-card {
      padding: 20px;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: var(--app-on-surface);
      letter-spacing: -1px;
    }

    .stat-label {
      color: var(--app-on-surface-variant);
      font-size: 14px;
      font-weight: 500;
      margin-top: 4px;
    }

    .alerts-card {
      margin-bottom: 28px;
    }

    .alert {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-weight: 500;
    }

    .alert:last-child {
      margin-bottom: 0;
    }

    .alert-critical {
      background-color: var(--app-critical-container);
      color: var(--app-on-critical-container);
    }

    .alert-warning {
      background-color: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }

    .alert-icon {
      margin-right: 14px;
      flex-shrink: 0;
    }

    .alert-badge {
      font-weight: 700;
    }

    .font-medium {
      font-weight: 600;
    }

    .quick-actions-card mat-card-content {
      padding-top: 16px;
    }

    .actions-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .actions-row a {
      border-radius: 8px;
    }

    .actions-row mat-icon {
      margin-right: 8px;
    }
  `,
})
export class DashboardComponent implements OnInit {
  private readonly lineService = inject(LineService);
  private readonly messageService = inject(MessageService);
  private readonly deviceService = inject(DeviceService);

  loading = signal(true);
  lines = signal<Line[]>([]);
  activeMessages = signal<BroadcastMessage[]>([]);
  devices = signal<Device[]>([]);

  criticalMessages = signal<BroadcastMessage[]>([]);
  offlineDevices = signal<Device[]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    forkJoin({
      lines: this.lineService.getAll(),
      messages: this.messageService.getAll(true),
      devices: this.deviceService.getAll(),
    }).subscribe({
      next: ({ lines, messages, devices }) => {
        this.lines.set(lines);
        this.activeMessages.set(messages);
        this.criticalMessages.set(messages.filter((m) => m.severity === 'CRITICAL'));
        this.devices.set(devices);
        this.offlineDevices.set(devices.filter((d) => d.status === 'OFFLINE'));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onlineDevices(): number {
    return this.devices().filter((d) => d.status === 'ONLINE').length;
  }
}
