// Passenger-facing display payloads pushed to kiosks and hubs.

import {
  BikesAllowed,
  LineInfo,
  MessageSeverity,
  PickupKind,
  WheelchairAccess,
} from './common.model';

// Display State
export interface DisplayState {
  stopId: string;
  stopName: string;
  /** GTFS platform_code for stops that publish one — null for bus poles
   *  and any stop without a platform designation. */
  stopPlatformCode?: string | null;
  /** GTFS stop_code — short identifier printed on the physical signpost
   *  (e.g. "BSP1234"). Rendered discreetly so passengers can confirm
   *  they're at the right stop. */
  stopShortCode?: string | null;
  lines: LineInfo[];
  arrivals: ArrivalInfo[];
  messages: MessageInfo[];
  version: number;
  generatedAt: string;
}

export interface ArrivalInfo {
  scheduledTime: string;
  destinationName: string;
  line: LineInfo;
  pickupKind?: PickupKind;
  wheelchairAccessible?: WheelchairAccess;
  bikesAllowed?: BikesAllowed;
  /** GTFS timepoint: false means the time is approximate. */
  timepoint?: boolean;
  /** Headway from frequencies.txt — seconds between consecutive
   *  departures during the active window. Null when the trip is on a
   *  fixed timetable. */
  frequencyHeadwaySeconds?: number | null;
  /** GTFS-Realtime delay applied to {@link scheduledTime} (seconds).
   *  Positive = late, negative = early. Null = no realtime update
   *  covers this arrival; the kiosk renders the scheduled time
   *  unchanged. Zero is meaningful — "the feed says on time" — and
   *  triggers the live indicator. */
  realtimeDelaySeconds?: number | null;
  /** Platform_code of the actual stop this arrival comes from.
   *  On a per-platform kiosk this matches the stop's own
   *  platformCode and is redundant. On a parent-station kiosk
   *  (Phase 1.3 aggregation) it varies per arrival and the kiosk
   *  renders it as a badge. */
  platformCode?: string | null;
  /** TAD booking flow attached to this arrival when the pickup is
   *  on-demand. Null on regular fixed-route trips. */
  booking?: BookingInfo | null;
}

export interface BookingInfo {
  phone: string | null;
  bookingUrl: string | null;
  infoUrl: string | null;
  message: string | null;
  priorNoticeMinutes: number | null;
}

export interface MessageInfo {
  title: string;
  content: string;
  severity: MessageSeverity;
}

// Hub Display State
export interface HubDisplayState {
  hubName: string;
  lines: LineInfo[];
  arrivals: HubArrivalInfo[];
  messages: MessageInfo[];
  version: number;
  generatedAt: string;
}

export interface HubArrivalInfo {
  scheduledTime: string;
  destinationName: string;
  platform: string;
  line: LineInfo;
  pickupKind?: PickupKind;
  wheelchairAccessible?: WheelchairAccess;
  bikesAllowed?: BikesAllowed;
  timepoint?: boolean;
  frequencyHeadwaySeconds?: number | null;
  realtimeDelaySeconds?: number | null;
  booking?: BookingInfo | null;
}
