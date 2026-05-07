import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  HubDisplayDialogComponent,
  HubDisplayDialogData,
  HubDisplayDialogResult,
} from '@shared/components/hub-display-dialog/hub-display-dialog.component';
import { AuthService } from '@core/auth/auth.service';
import { LineService } from '@core/api/line.service';
import { MessageService } from '@core/api/message.service';
import { DashboardService } from '@core/api/dashboard.service';
import { Line, BroadcastMessage, Device } from '@shared/models';
import { StatsSkeletonComponent } from '@shared/components/skeleton/stats-skeleton.component';
import { lineTextColor, readableTextColor } from '@shared/utils/color.utils';
import { SNACKBAR_DURATIONS } from '@shared/utils/snackbar.constants';
import { DataOverviewCardComponent } from './data-overview-card.component';
import { FeedInfoCardComponent } from './feed-info-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    StatsSkeletonComponent,
    FeedInfoCardComponent,
    DataOverviewCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard">
      <h1 class="page-title">Dashboard</h1>

      @if (isAdmin()) {
        <app-feed-info-card />
        <app-data-overview-card />
      }

      @if (loading()) {
        <app-stats-skeleton />
      } @else {
        <!-- Stats Grid -->
        <div class="stats-grid" animate.enter="grid-stagger">
          @if (isAdmin()) {
            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-icon lines-icon">
                  <mat-icon>subway</mat-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ lineCount() }}</div>
                  <div class="stat-label">Lines</div>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-icon stops-icon">
                  <mat-icon>place</mat-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ stopCount() }}</div>
                  <div class="stat-label">Stops</div>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-icon routes-icon">
                  <mat-icon>alt_route</mat-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ itineraryCount() }}</div>
                  <div class="stat-label">Itineraries</div>
                </div>
              </mat-card-content>
            </mat-card>
          }

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon messages-icon">
                <mat-icon>campaign</mat-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ activeMessages().length }}</div>
                <div class="stat-label">Active Messages</div>
              </div>
            </mat-card-content>
          </mat-card>

          @if (isAdmin()) {
            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-icon devices-icon" [class.warning]="totalDevicesCount() > 0 && deviceHealthPercent() < 100">
                  <mat-icon>{{ totalDevicesCount() === 0 || deviceHealthPercent() === 100 ? 'tv' : 'tv_off' }}</mat-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">
                    @if (totalDevicesCount() === 0) {
                      —
                    } @else {
                      {{ onlineDevicesCount() }}/{{ totalDevicesCount() }}
                    }
                  </div>
                  <div class="stat-label">Devices Online</div>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>

        <!-- Network Overview -->
        @if (isAdmin()) {
        <div class="overview-grid" animate.enter="fade-in">
          <!-- Lines Overview -->
          <mat-card class="overview-card">
            <mat-card-header>
              <mat-card-title>Network Lines</mat-card-title>
              @if (hasMoreLines()) {
                <a mat-button routerLink="/admin/lines" class="view-all">View All</a>
              }
            </mat-card-header>
            <mat-card-content>
              @if (lineCount() === 0) {
                <div class="empty-state">
                  <mat-icon>subway</mat-icon>
                  <span>No lines configured</span>
                </div>
              } @else {
                <div class="lines-overview">
                  @for (line of displayedLines(); track line.id) {
                    <a
                      [routerLink]="['/admin/stops']"
                      [queryParams]="{ lineId: line.id }"
                      class="line-item"
                      [matTooltip]="line.name + ' - ' + line.stopCount + ' stops, ' + line.itineraryCount + ' itineraries'"
                    >
                      <span
                        class="line-badge"
                        [style.backgroundColor]="line.color"
                        [style.color]="lineTextColor(line)"
                      >
                        {{ line.code }}
                      </span>
                      <span class="line-name">{{ line.name }}</span>
                      <span class="line-stats">{{ line.stopCount }} stops</span>
                    </a>
                  }
                </div>
              }
            </mat-card-content>
          </mat-card>

          <!-- Device Health -->
          <mat-card class="overview-card">
            <mat-card-header>
              <mat-card-title>Device Health</mat-card-title>
              <a mat-button routerLink="/admin/devices" class="view-all">View All</a>
            </mat-card-header>
            <mat-card-content>
              @if (totalDevicesCount() === 0) {
                <div class="empty-state">
                  <mat-icon>tv</mat-icon>
                  <span>No devices registered</span>
                </div>
              } @else {
                <div class="health-container">
                  <div class="health-summary">
                    <div class="health-ring" [class.healthy]="deviceHealthPercent() === 100" [class.warning]="deviceHealthPercent() < 100">
                      <span class="health-percent">{{ deviceHealthPercent() }}%</span>
                    </div>
                    <div class="health-breakdown">
                      <div class="health-stat online">
                        <mat-icon>check_circle</mat-icon>
                        <span>{{ onlineDevicesCount() }} online</span>
                      </div>
                      <div class="health-stat offline">
                        <mat-icon>cancel</mat-icon>
                        <span>{{ totalDevicesCount() - onlineDevicesCount() }} offline</span>
                      </div>
                      <div class="health-stat total">
                        <mat-icon>devices</mat-icon>
                        <span>{{ totalDevicesCount() }} total</span>
                      </div>
                    </div>
                  </div>
                  @if (totalDevicesCount() - onlineDevicesCount() > 0) {
                    <div class="offline-preview">
                      <div class="offline-title">Offline devices:</div>
                      @for (device of displayedOfflineDevices(); track device.id) {
                        <div class="offline-device">
                          <mat-icon>tv_off</mat-icon>
                          <span>{{ device.stopName }}</span>
                        </div>
                      }
                      @if (remainingOfflineCount() > 0) {
                        <a routerLink="/admin/devices" class="offline-more">
                          +{{ remainingOfflineCount() }} more
                        </a>
                      }
                    </div>
                  }
                </div>
              }
            </mat-card-content>
          </mat-card>
        </div>

        }

        <!-- Critical Messages Section -->
        @if (criticalMessages().length > 0) {
          <mat-card class="alerts-card" animate.enter="fade-in">
            <mat-card-header>
              <mat-card-title>
                <mat-icon class="title-icon critical">error</mat-icon>
                Critical Messages
                <span class="alert-count">({{ criticalMessages().length }})</span>
              </mat-card-title>
              <a mat-button routerLink="/admin/messages" class="view-all">View All</a>
            </mat-card-header>
            <mat-card-content>
              @for (message of displayedCriticalMessages(); track message.id) {
                <div class="alert alert-critical">
                  <mat-icon class="alert-icon">error</mat-icon>
                  <div class="alert-content">
                    <span class="alert-title">{{ message.title }}</span>
                    <span class="alert-scope">{{ message.scopeType === 'NETWORK' ? 'Network-wide' : message.scopeInfo?.name }}</span>
                  </div>
                </div>
              }
              @if (remainingCriticalCount() > 0) {
                <a routerLink="/admin/messages" class="alert-more">
                  +{{ remainingCriticalCount() }} more critical messages
                </a>
              }
            </mat-card-content>
          </mat-card>
        } @else if (!loading()) {
          <mat-card class="ops-ok-card" animate.enter="fade-in">
            <mat-icon class="ops-ok-icon">check_circle</mat-icon>
            <span class="ops-ok-text">No critical messages — all clear.</span>
          </mat-card>
        }

        <!-- Recent Messages -->
        @if (recentMessages().length > 0) {
          <mat-card class="recent-card" animate.enter="fade-in">
            <mat-card-header>
              <mat-card-title>Recent Messages</mat-card-title>
              <a mat-button routerLink="/admin/messages" class="view-all">View All</a>
            </mat-card-header>
            <mat-card-content>
              <div class="messages-list">
                @for (message of recentMessages(); track message.id) {
                  <div class="message-item">
                    <div
                      class="message-severity"
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
                    <div class="message-info">
                      <div class="message-title">{{ message.title }}</div>
                      <div class="message-meta">
                        {{ message.scopeType === 'NETWORK' ? 'Network-wide' : message.scopeInfo?.name }}
                        · {{ message.startTime | date: 'short' }}
                      </div>
                    </div>
                    <span
                      class="message-status"
                      [class.active]="getMessageStatus(message) === 'active'"
                      [class.expired]="getMessageStatus(message) === 'expired'"
                    >
                      @switch (getMessageStatus(message)) {
                        @case ('active') { Active }
                        @case ('scheduled') { Scheduled }
                        @case ('expired') { Expired }
                      }
                    </span>
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>
        }

        <!-- Quick Actions -->
        <mat-card class="quick-actions-card" animate.enter="fade-in">
          <mat-card-header>
            <mat-card-title>Quick Actions</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="actions-grid">
              <a mat-stroked-button routerLink="/admin/messages" class="action-btn">
                <mat-icon>campaign</mat-icon>
                <span>New Message</span>
              </a>
              @if (isAdmin()) {
                <a mat-stroked-button routerLink="/admin/lines" class="action-btn">
                  <mat-icon>subway</mat-icon>
                  <span>Manage Lines</span>
                </a>
                <a mat-stroked-button routerLink="/admin/stops" class="action-btn">
                  <mat-icon>place</mat-icon>
                  <span>Manage Stops</span>
                </a>
                <a mat-stroked-button routerLink="/admin/schedules" class="action-btn">
                  <mat-icon>schedule</mat-icon>
                  <span>Edit Schedules</span>
                </a>
                <a mat-stroked-button routerLink="/admin/devices" class="action-btn">
                  <mat-icon>tv</mat-icon>
                  <span>Register Device</span>
                </a>
              }
              <a mat-stroked-button routerLink="/map" class="action-btn">
                <mat-icon>map</mat-icon>
                <span>Network Map</span>
              </a>
              @if (isAdmin()) {
                <button mat-stroked-button class="action-btn" (click)="openHubDisplay()">
                  <mat-icon>hub</mat-icon>
                  <span>Hub Display</span>
                </button>
                <a mat-stroked-button routerLink="/admin/users" class="action-btn">
                  <mat-icon>people</mat-icon>
                  <span>Manage Users</span>
                </a>
              }
            </div>
          </mat-card-content>
        </mat-card>
      }
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

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--app-gap-grid);
      margin-bottom: 28px;
    }

    .stat-card {
      border-radius: var(--app-radius-md);
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--app-radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .stat-icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: white;
    }

    .lines-icon {
      background: var(--app-stat-lines);
    }

    .stops-icon {
      background: var(--app-stat-stops);
    }

    .routes-icon {
      background: var(--app-stat-routes);
    }

    .messages-icon {
      background: var(--app-stat-messages);
    }

    .devices-icon {
      background: var(--app-stat-devices);
    }

    .devices-icon.warning {
      background: var(--app-stat-devices-warning);
    }

    .stat-info {
      min-width: 0;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--app-on-surface);
      letter-spacing: -0.5px;
      line-height: 1.2;
    }

    .stat-label {
      color: var(--app-on-surface-variant);
      font-size: 13px;
      font-weight: 500;
    }

    /* Overview Grid */
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: var(--app-gap-grid);
      margin-bottom: 28px;
    }

    .overview-card {
      border-radius: var(--app-radius-md);
    }

    .overview-card mat-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
    }

    /* Lines Overview */
    .lines-overview {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .line-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--app-radius-sm);
      text-decoration: none;
      color: inherit;
      transition: background-color 0.2s;
    }

    .line-item:hover {
      background-color: var(--app-surface-container-high);
    }

    .line-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: var(--app-line-badge-radius);
      color: white;
      font-size: 12px;
      font-weight: 600;
      min-width: 36px;
      text-align: center;
    }

    .line-name {
      flex: 1;
      font-weight: 500;
      color: var(--app-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .line-stats {
      font-size: 13px;
      color: var(--app-on-surface-variant);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* Device Health */
    .health-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .health-summary {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .health-ring {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 6px solid var(--app-critical);
      background-color: var(--app-critical-container);
    }

    .health-ring.healthy {
      border-color: var(--app-success);
      background-color: var(--app-success-container);
    }

    .health-ring.warning {
      border-color: var(--app-critical);
      background-color: var(--app-critical-container);
    }

    .health-percent {
      font-size: 20px;
      font-weight: 700;
      color: var(--app-on-surface);
    }

    .health-breakdown {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .health-stat {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .health-stat mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .health-stat.online {
      color: var(--app-success);
    }

    .health-stat.offline {
      color: var(--app-critical);
    }

    .health-stat.total {
      color: var(--app-on-surface-variant);
    }

    .offline-preview {
      border-top: 1px solid var(--app-outline-variant);
      padding-top: 12px;
    }

    .offline-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--app-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .offline-device {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: 14px;
      color: var(--app-on-surface);
    }

    .offline-device mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--app-critical);
    }

    .offline-more {
      display: inline-block;
      margin-top: 4px;
      font-size: 13px;
      color: var(--app-primary);
      text-decoration: none;
    }

    .offline-more:hover {
      text-decoration: underline;
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px;
      color: var(--app-on-surface-variant);
    }

    .empty-state mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.5;
    }

    /* "All clear" placeholder shown when no critical messages exist —
       intentionally subdued so that the rare error state, when it returns,
       grabs attention by contrast. */
    .ops-ok-card {
      margin-bottom: 28px;
      padding: 16px 20px;
      border-radius: var(--app-radius-md);
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--app-success-container);
      color: var(--app-on-success-container);
    }

    .ops-ok-icon {
      color: var(--app-success);
    }

    .ops-ok-text {
      font-weight: 500;
      font-size: 14px;
    }

    /* Alerts */
    .alerts-card {
      margin-bottom: 28px;
      border-radius: var(--app-radius-md);
    }

    .alerts-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .title-icon.warning {
      color: var(--app-warning);
    }

    .title-icon.critical {
      color: var(--app-critical);
    }

    .alert {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-radius: var(--app-radius-sm);
      margin-bottom: 8px;
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
      margin-right: 12px;
      flex-shrink: 0;
    }

    .alert-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .alert-title {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .alert-scope {
      font-size: 13px;
      opacity: 0.8;
    }

    .alerts-card mat-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .alert-count {
      font-weight: 400;
      font-size: 14px;
      color: var(--app-on-surface-variant);
      margin-left: 4px;
    }

    .alert-more {
      display: block;
      padding: 10px 16px;
      margin-bottom: 8px;
      border-radius: var(--app-radius-sm);
      background-color: var(--app-surface-container);
      color: var(--app-primary);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      transition: background-color 0.2s;
    }

    .alert-more:hover {
      background-color: var(--app-surface-container-high);
    }

    .alert-more:last-child {
      margin-bottom: 0;
    }

    /* Recent Messages */
    .recent-card {
      margin-bottom: 28px;
      border-radius: var(--app-radius-md);
    }

    .recent-card mat-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .view-all {
      margin-right: -8px;
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .message-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: var(--app-radius-sm);
      background-color: var(--app-surface-container);
    }

    .message-severity {
      width: 36px;
      height: 36px;
      border-radius: var(--app-radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .message-severity mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: white;
    }

    .message-severity.critical {
      background-color: var(--app-critical);
    }

    .message-severity.warning {
      background-color: var(--app-warning);
    }

    .message-severity.info {
      background-color: var(--app-info);
    }

    .message-info {
      flex: 1;
      min-width: 0;
    }

    .message-title {
      font-weight: 500;
      color: var(--app-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .message-meta {
      font-size: 13px;
      color: var(--app-on-surface-variant);
    }

    .message-status {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: var(--app-line-badge-radius);
      background-color: var(--app-surface-container-high);
      color: var(--app-on-surface-variant);
    }

    .message-status.active {
      background-color: var(--app-success-container);
      color: var(--app-on-success-container);
    }

    .message-status.expired {
      background-color: var(--app-surface-container-highest);
      color: var(--app-on-surface-muted);
    }

    /* Quick Actions */
    .quick-actions-card {
      border-radius: var(--app-radius-md);
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      padding-top: 8px;
    }

    .action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 20px 16px;
      height: auto;
      border-radius: var(--app-radius-md);
    }

    .action-btn mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--app-primary);
    }

    .action-btn span {
      font-size: 13px;
      font-weight: 500;
    }

    /* Enter animations defined globally — see styles.scss section 13a */

    /* Responsive */
    @media (max-width: 600px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .overview-grid {
        grid-template-columns: 1fr;
      }

      .actions-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .alert-content {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
    }
  `,
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly lineService = inject(LineService);
  private readonly messageService = inject(MessageService);
  private readonly dashboardService = inject(DashboardService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly isAdmin = this.authService.isAdmin;

  loading = signal(true);
  /** Lines for the hub-display dialog selector. Populated lazily the first
   *  time the user opens the dialog so the initial dashboard load stays small. */
  hubDialogLines = signal<Line[] | null>(null);
  // Counters returned by /api/admin/dashboard. Default 0 so the cards render
  // sensibly during the first paint before the response arrives.
  lineCount = signal(0);
  stopCount = signal(0);
  itineraryCount = signal(0);
  topLines = signal<Line[]>([]);
  hasMoreLinesValue = signal(false);
  activeMessages = signal<BroadcastMessage[]>([]);
  allMessages = signal<BroadcastMessage[]>([]);
  recentMessagesSignal = signal<BroadcastMessage[]>([]);
  offlineDevices = signal<Device[]>([]);
  remainingOfflineCount = signal(0);
  onlineDevicesCount = signal(0);
  totalDevicesCount = signal(0);

  criticalMessages = computed(() =>
    this.activeMessages().filter((m) => m.severity === 'CRITICAL')
  );

  displayedCriticalMessages = computed(() => this.criticalMessages().slice(0, 6));

  remainingCriticalCount = computed(() =>
    Math.max(0, this.criticalMessages().length - 6)
  );

  // Renamed for clarity — the dashboard endpoint already trims to the preview.
  displayedOfflineDevices = computed(() => this.offlineDevices());

  deviceHealthPercent = computed(() => {
    const total = this.totalDevicesCount();
    if (total === 0) { return 100; }
    return Math.round((this.onlineDevicesCount() / total) * 100);
  });

  displayedLines = computed(() => this.topLines());

  hasMoreLines = computed(() => this.hasMoreLinesValue());

  recentMessages = computed(() =>
    [...this.recentMessagesSignal()]
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 5)
  );

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    if (this.isAdmin()) {
      // Single aggregated call — replaces the legacy forkJoin of five
      // non-paginated GETs that each downloaded the entire domain table.
      this.dashboardService.getSummary().subscribe({
        next: (summary) => {
          this.lineCount.set(summary.lineCount);
          this.stopCount.set(summary.stopCount);
          this.itineraryCount.set(summary.itineraryCount);
          this.topLines.set(summary.topLines);
          this.hasMoreLinesValue.set(summary.lineCount > summary.topLines.length);
          this.activeMessages.set(summary.activeMessages);
          this.allMessages.set(summary.activeMessages);
          this.recentMessagesSignal.set(summary.recentMessages);
          this.totalDevicesCount.set(summary.devices.total);
          this.onlineDevicesCount.set(summary.devices.online);
          this.offlineDevices.set(summary.devices.offlinePreview);
          this.remainingOfflineCount.set(
            Math.max(0, summary.devices.offline - summary.devices.offlinePreview.length));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar
            .open('Failed to load dashboard data', 'Retry', { duration: SNACKBAR_DURATIONS.retryable, panelClass: 'error-snackbar' })
            .onAction()
            .subscribe(() => this.loadData());
        },
      });
    } else {
      // Agents only see messages — no need for the admin-gated dashboard endpoint.
      this.messageService.getAll().subscribe({
        next: (allMessages) => {
          this.allMessages.set(allMessages);
          this.activeMessages.set(allMessages.filter(m => m.active));
          this.recentMessagesSignal.set(allMessages);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar
            .open('Failed to load dashboard data', 'Retry', { duration: SNACKBAR_DURATIONS.retryable, panelClass: 'error-snackbar' })
            .onAction()
            .subscribe(() => this.loadData());
        },
      });
    }
  }

  openHubDisplay(): void {
    // The hub-display selector needs the full line list (with stops); the
    // dashboard endpoint only ships the top 6, so lazy-load on first open.
    const cached = this.hubDialogLines();
    if (cached !== null) {
      this.openHubDialogWith(cached);
      return;
    }
    this.lineService.getAll().subscribe({
      next: (lines) => {
        this.hubDialogLines.set(lines);
        this.openHubDialogWith(lines);
      },
      error: () => {
        this.snackBar.open('Failed to load lines for hub selector', 'Close',
          { duration: SNACKBAR_DURATIONS.error, panelClass: 'error-snackbar' });
      },
    });
  }

  private openHubDialogWith(lines: Line[]): void {
    this.dialog
      .open(HubDisplayDialogComponent, {
        data: { lines } as HubDisplayDialogData,
        width: '550px',
      })
      .afterClosed()
      .subscribe((result: HubDisplayDialogResult | undefined) => {
        if (result) {
          const params = new URLSearchParams();
          params.set('stopIds', result.stopIds.join(','));
          params.set('name', result.hubName);
          window.open(`/hub?${params.toString()}`, '_blank');
        }
      });
  }

  // Expose the shared color helpers to the template for line-badge contrast.
  // {@link lineTextColor} preferred (uses server-resolved textColor), with
  // {@link readableTextColor} kept for cases where only the bg color is known.
  readableTextColor = readableTextColor;
  lineTextColor = lineTextColor;

  getMessageStatus(message: BroadcastMessage): 'active' | 'scheduled' | 'expired' {
    // The server's `active` flag is the source of truth — it accounts for the
    // backend's wall clock, which is what passengers' displays consume.
    // We only fall back to start/end comparison to differentiate "not yet"
    // from "already over" when the server says inactive.
    if (message.active) { return 'active'; }
    const now = new Date();
    const start = new Date(message.startTime);
    return now < start ? 'scheduled' : 'expired';
  }
}
