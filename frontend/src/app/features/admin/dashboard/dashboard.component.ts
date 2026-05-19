import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '@core/auth/auth.service';
import { MessageService } from '@core/api/message.service';
import { DashboardService, DashboardSummary } from '@core/api/dashboard.service';
import { BroadcastMessage } from '@shared/models';
import { AdminPageHeaderComponent } from '@shared/components/admin-page-header/admin-page-header.component';
import { LineBadgeComponent } from '@shared/components/line-badge/line-badge.component';
import { SeverityIconComponent } from '@shared/components/severity-icon/severity-icon.component';
import { StatsSkeletonComponent } from '@shared/components/skeleton/stats-skeleton.component';
import { FeedCreditsComponent } from '@shared/components/feed-credits/feed-credits.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { lineTextColor } from '@shared/utils/color.utils';
import { DataOverviewCardComponent } from './data-overview-card.component';
import { FeedInfoCardComponent } from './feed-info-card.component';
import { TranslocoDirective } from '@jsverse/transloco';
import { map } from 'rxjs';

/** Shape returned by the resource when the user is an AGENT (non-admin).
 *  Structured the same way as DashboardSummary so computed() derivations
 *  stay uniform regardless of the authenticated role. */
interface AgentView {
  lineCount: 0;
  stopCount: 0;
  itineraryCount: 0;
  topLines: [];
  activeMessages: BroadcastMessage[];
  recentMessages: BroadcastMessage[];
  devices: { total: 0; online: 0; offline: 0; offlinePreview: [] };
}

type DashboardData = DashboardSummary | AgentView;

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
    AdminPageHeaderComponent,
    LineBadgeComponent,
    SeverityIconComponent,
    StatsSkeletonComponent,
    FeedInfoCardComponent,
    DataOverviewCardComponent,
    FeedCreditsComponent,
    EmptyStateComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly dashboardService = inject(DashboardService);

  readonly isAdmin = this.authService.isAdmin;

  // Single resource that switches between the admin summary endpoint and the
  // agent message-only endpoint based on the authenticated role.
  private readonly dashboardResource = rxResource<DashboardData, boolean>({
    params: () => this.isAdmin(),
    stream: ({ params: isAdmin }) => {
      if (isAdmin) {
        // Single aggregated call — replaces the legacy forkJoin of five
        // non-paginated GETs that each downloaded the entire domain table.
        return this.dashboardService.getSummary();
      }
      // Agents only see messages — no need for the admin-gated dashboard endpoint.
      return this.messageService.getAll().pipe(
        map((allMessages): AgentView => ({
          lineCount: 0,
          stopCount: 0,
          itineraryCount: 0,
          topLines: [],
          activeMessages: allMessages.filter((m) => m.active),
          recentMessages: allMessages,
          devices: { total: 0, online: 0, offline: 0, offlinePreview: [] },
        })),
      );
    },
  });

  // Expose loading/error state directly from the resource.
  readonly loading = computed(() => this.dashboardResource.isLoading());
  readonly loadError = computed(() => this.dashboardResource.error() ?? null);

  // Safe accessor — returns undefined when the resource has no value yet or is
  // in an error state (where calling .value() would throw ResourceValueError).
  private readonly safeData = computed(() =>
    this.dashboardResource.hasValue() ? this.dashboardResource.value() : undefined,
  );

  // Computed fields extracted from the resource value — default to safe empty
  // values while loading or on error so templates render without null guards.
  readonly lineCount = computed(() => this.safeData()?.lineCount ?? 0);
  readonly stopCount = computed(() => this.safeData()?.stopCount ?? 0);
  readonly itineraryCount = computed(() => this.safeData()?.itineraryCount ?? 0);
  readonly topLines = computed(() => this.safeData()?.topLines ?? []);
  readonly activeMessages = computed(
    () => this.safeData()?.activeMessages ?? [],
  );
  readonly onlineDevicesCount = computed(
    () => this.safeData()?.devices.online ?? 0,
  );
  readonly totalDevicesCount = computed(
    () => this.safeData()?.devices.total ?? 0,
  );
  readonly offlineDevices = computed(
    () => this.safeData()?.devices.offlinePreview ?? [],
  );
  readonly remainingOfflineCount = computed(() => {
    const data = this.safeData();
    if (!data) { return 0; }
    return Math.max(0, data.devices.offline - data.devices.offlinePreview.length);
  });
  readonly hasMoreLinesValue = computed(() => {
    const data = this.safeData();
    if (!data) { return false; }
    return data.lineCount > data.topLines.length;
  });

  readonly criticalMessages = computed(() =>
    this.activeMessages().filter((m) => m.severity === 'CRITICAL'),
  );

  readonly displayedCriticalMessages = computed(() => this.criticalMessages().slice(0, 6));

  readonly remainingCriticalCount = computed(() =>
    Math.max(0, this.criticalMessages().length - 6),
  );

  // The dashboard endpoint already trims to the preview.
  readonly displayedOfflineDevices = computed(() => this.offlineDevices());

  readonly deviceHealthPercent = computed(() => {
    const total = this.totalDevicesCount();
    if (total === 0) { return 100; }
    return Math.round((this.onlineDevicesCount() / total) * 100);
  });

  /** True for an admin dashboard where no GTFS data has ever been imported.
   *  Used to swap the regular stat grid for a guided onboarding banner that
   *  tells the user to start with an import rather than poking the empty
   *  "create a line" CTAs. */
  readonly isFreshInstall = computed(() =>
    this.isAdmin() &&
    !this.loading() &&
    !this.loadError() &&
    this.lineCount() === 0 &&
    this.stopCount() === 0 &&
    this.totalDevicesCount() === 0,
  );

  readonly displayedLines = computed(() => this.topLines());

  readonly hasMoreLines = computed(() => this.hasMoreLinesValue());

  readonly recentMessages = computed(() => {
    const data = this.safeData();
    return [...(data?.recentMessages ?? [])]
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 5);
  });

  loadData(): void {
    this.dashboardResource.reload();
  }

  reload(): void {
    this.dashboardResource.reload();
  }

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
