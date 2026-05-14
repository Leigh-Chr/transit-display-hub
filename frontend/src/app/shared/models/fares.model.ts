// GTFS Fares v1 + v2 — the public fare-calculation result and the
// admin browse surfaces. Self-contained: no cross-domain imports.

// GTFS fares calculation result (public)
export interface FareV1Option {
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

export interface FareV2Option {
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

// GTFS Fares v1 (admin browse)
export type FarePaymentMethod = 'ON_BOARD' | 'BEFORE_BOARDING';

export interface FareAttribute {
  id: string;
  externalId: string | null;
  price: string;
  currency: string;
  paymentMethod: FarePaymentMethod | null;
  /** GTFS transfers: 0=no transfers, 1=one, 2=two, null=unlimited. */
  transfers: number | null;
  /** Seconds during which a transfer remains valid. */
  transferDuration: number | null;
  agencyId: string | null;
  agencyName: string | null;
  rules: FareRuleSummary[];
}

export interface FareRuleSummary {
  id: string;
  routeId: string | null;
  routeCode: string | null;
  originId: string | null;
  destinationId: string | null;
  containsId: string | null;
}

// GTFS Fares v2 (admin browse)
export interface FaresV2 {
  areas: FareArea[];
  timeframes: FareTimeframe[];
  products: FareProduct[];
  legRules: FareLegRule[];
  transferRules: FareTransferRule[];
  networks: FareNetwork[];
  fareMedia: FareMedia[];
  legJoinRules: FareLegJoinRule[];
}

export interface FareLegJoinRule {
  id: string;
  fromNetworkId: string | null;
  toNetworkId: string | null;
  fromStopName: string | null;
  toStopName: string | null;
}

export interface FareNetwork {
  id: string;
  externalId: string;
  name: string | null;
  routeCount: number;
}

export interface FareMedia {
  id: string;
  externalId: string;
  name: string | null;
  /** GTFS fare_media_type: 0=none, 1=paper, 2=transit_card,
   *  3=contactless_emv, 4=mobile_app. */
  mediaType: number | null;
}

export interface FareArea {
  id: string;
  externalId: string;
  name: string | null;
  stopCount: number;
}

export interface FareTimeframe {
  id: string;
  timeframeGroupId: string;
  /** ISO-8601 "HH:mm:ss". */
  startTime: string | null;
  endTime: string | null;
  serviceId: string | null;
}

export interface FareProduct {
  id: string;
  externalId: string;
  name: string | null;
  fareMediaId: string | null;
  amount: string;
  currency: string;
}

export interface FareLegRule {
  id: string;
  legGroupId: string | null;
  networkId: string | null;
  fromAreaName: string | null;
  toAreaName: string | null;
  fromTimeframeGroupId: string | null;
  toTimeframeGroupId: string | null;
  productExternalId: string | null;
  productAmount: string | null;
  productCurrency: string | null;
  rulePriority: number | null;
}

export interface FareTransferRule {
  id: string;
  fromLegGroupId: string | null;
  toLegGroupId: string | null;
  transferCount: number | null;
  durationLimit: number | null;
  durationLimitType: number | null;
  /** GTFS fare_transfer_type: 0=combined, 1=A-then-transfer, 2=transfer-replaces-A. */
  fareTransferType: number;
  productExternalId: string | null;
  productAmount: string | null;
  productCurrency: string | null;
}
