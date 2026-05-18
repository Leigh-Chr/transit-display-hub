// GTFS Fares calculation result (public, consumed by the stop popup).

interface FareV1Option {
  fareId: string;
  price: number | null;
  currency: string;
  paymentMethod: string | null;
  transfers: number | null;
  transferDurationSeconds: number | null;
  agencyName: string | null;
  matchedRoute: string | null;
  matchedOriginZone: string | null;
  matchedDestinationZone: string | null;
}

interface FareV2Option {
  legGroupId: string | null;
  fareProductId: string | null;
  fareProductName: string | null;
  amount: number | null;
  currency: string | null;
  fromAreaId: string | null;
  fromAreaName: string | null;
  toAreaId: string | null;
  toAreaName: string | null;
  rulePriority: number | null;
  networkId: string | null;
  fromTimeframeGroupId: string | null;
  toTimeframeGroupId: string | null;
}

export interface FareCalculationResult {
  fromStopId: string;
  fromStopName: string;
  fromZoneId: string | null;
  toStopId: string;
  toStopName: string;
  toZoneId: string | null;
  v1: FareV1Option[];
  v2: FareV2Option[];
}
