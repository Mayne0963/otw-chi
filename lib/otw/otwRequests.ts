// lib/otw/otwRequests.ts

import {
  OtwCustomerId,
  OtwDriverId,
  OtwRequestId,
  newRequestId,
} from "./otwIds";
import {
  OtwLocation,
  OtwMembership,
  OtwRequest,
  OtwTierDefinition,
} from "./otwTypes";
import { OtwRequestStatus, ServiceType } from "./otwEnums";
import {
  ensureMembership,
  deductMiles,
} from "./otwMembership";
import { getTierById } from "./otwTierCatalog";
import {
  evaluateRequestEligibility,
  RequestEligibilityInfo,
} from "./otwEligibility";
import { Result, ok, err } from "./otwResult";
import { recordDriverCompletedJob } from "./otwDrivers";
import { awardNipForCompletedRequest } from "./otwNip";
import {
  haversineDistanceKm,
  estimateDurationMinutes,
  otwMilesFromRoute,
} from "./otwGeo";

/**
 * In-memory request store.
 * TODO: replace with database (Prisma, etc.) in production.
 */
const requestStore: OtwRequest[] = [];

/**
 * Simple DTO for request creation.
 * NOTE: estimatedMiles is required for now.
 * Geo-based calculation will replace manual values later.
 */
export interface CreateOtwRequestInput {
  customerId: OtwCustomerId;
  serviceType: ServiceType;

  // If not provided, and pickup/dropoff are present,
  // the system will derive OTW miles from geo metrics.
  estimatedMiles?: number;

  notes?: string;
  pickupLocation?: OtwLocation;
  dropoffLocation?: OtwLocation;

  // Optional precomputed route metrics from frontend or another service
  distanceKmOverride?: number;
  durationMinutesOverride?: number;
}

const deriveRouteAndMiles = (input: CreateOtwRequestInput) => {
  let distanceKm: number | undefined = input.distanceKmOverride;
  let durationMinutes: number | undefined = input.durationMinutesOverride;

  if (
    (distanceKm === undefined || durationMinutes === undefined) &&
    input.pickupLocation &&
    input.dropoffLocation
  ) {
    distanceKm = haversineDistanceKm(
      input.pickupLocation,
      input.dropoffLocation
    );
    durationMinutes = estimateDurationMinutes(distanceKm);
  }

  let estimatedMiles: number | undefined = input.estimatedMiles;

  if (
    (estimatedMiles === undefined || estimatedMiles <= 0) &&
    distanceKm !== undefined &&
    durationMinutes !== undefined
  ) {
    estimatedMiles = otwMilesFromRoute({
      distanceKm,
      durationMinutes,
      complexityFactor: 1, // can be tuned per serviceType later
    });
  }

  return {
    distanceKm,
    durationMinutes,
    estimatedMiles,
  };
};

/**
 * Public API shape for creation: includes the created request
 * plus eligibility/upgrade info if relevant.
 */
export interface CreateOtwRequestResult {
  request: OtwRequest;
  membership: OtwMembership;
  tier: OtwTierDefinition;
  eligibility: RequestEligibilityInfo;
}

/**
 * Create a new OTW request with membership gating:
 * - Ensure membership exists
 * - Check if membership & tier can cover miles
 * - Deduct miles on success
 * - Create request and store it
 */
export const createOtwRequest = async (
  input: CreateOtwRequestInput
): Promise<Result<CreateOtwRequestResult, any>> => {
  const { distanceKm, durationMinutes, estimatedMiles } =
    deriveRouteAndMiles(input);

  if (!estimatedMiles || estimatedMiles <= 0) {
    return err({
      message:
        "Unable to compute OTW miles. Provide estimatedMiles or valid pickup/dropoff locations.",
    });
  }

  // Ensure membership
  const ensured = ensureMembership(input.customerId);
  if (!ensured.ok) {
    return err({
      message: "Unable to ensure membership.",
      details: ensured.error,
    });
  }

  const membership = ensured.data;
  const tier = getTierById(membership.tierId);
  if (!tier) {
    return err({
      message: "Tier not found for membership.",
    });
  }

  // Evaluate eligibility
  const eligibilityResult = evaluateRequestEligibility(
    membership,
    tier,
    estimatedMiles
  );
  if (!eligibilityResult.ok) {
    // Not eligible; return info object with reason + suggested upgrade
    return err({
      message: "Request not eligible for current membership.",
      info: eligibilityResult.error,
    });
  }
  const eligibility = eligibilityResult.data;

  // Deduct miles from membership
  const deduction = deductMiles(membership, estimatedMiles);
  if (!deduction.ok) {
    return err({
      message: "Failed to deduct OTW miles for this request.",
      details: deduction.error,
    });
  }

  // Build request
  const nowIso = new Date().toISOString();
  const requestId: OtwRequestId = newRequestId();
  const newRequest: OtwRequest = {
    id: requestId,
    customerId: input.customerId,
    serviceType: input.serviceType,
    status: "PENDING",
    createdAt: nowIso,
    updatedAt: nowIso,
    assignedDriverId: undefined,
    acceptedAtIso: undefined,
    completedAtIso: undefined,
    pickupLocation: input.pickupLocation,
    dropoffLocation: input.dropoffLocation,
    estimatedDistanceKm: distanceKm,
    estimatedDurationMinutes: durationMinutes,
    estimatedMiles,
    chargedMiles: undefined,
    notes: input.notes,
  };

  requestStore.push(newRequest);
  return ok({
    request: newRequest,
    membership,
    tier,
    eligibility,
  });
};

/**
 * Basic read helpers
 */
export const getRequestById = (
  requestId: OtwRequestId
): OtwRequest | null => {
  return requestStore.find((r) => r.id === requestId) || null;
};

export const listRequestsForCustomer = (
  customerId: OtwCustomerId
): OtwRequest[] => {
  return requestStore
    .filter((r) => r.customerId === customerId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );
};

export const listAllRequests = (): OtwRequest[] => [...requestStore];

/**
 * Update status lifecycle for a request (basic early version).
 */
export const updateRequestStatus = (
  requestId: OtwRequestId,
  status: OtwRequestStatus,
  payload?: {
    assignedDriverId?: OtwDriverId;
  }
): Result<OtwRequest> => {
  const request = requestStore.find((r) => r.id === requestId);
  if (!request) {
    return err("Request not found.");
  }

  request.status = status;
  request.updatedAt = new Date().toISOString();

  if (status === "MATCHED" && payload?.assignedDriverId) {
    request.assignedDriverId = payload.assignedDriverId;
  }
  if (status === "ACCEPTED") {
    request.acceptedAtIso = new Date().toISOString();
  }
  if (status === "COMPLETED") {
    request.completedAtIso = new Date().toISOString();
    // Later: set chargedMiles, further metrics, NIP rewards, etc.
  }
  return ok(request);
};

/**
 * Requests that are not yet assigned to a driver.
 */
export const listOpenRequests = (): OtwRequest[] => {
  return requestStore.filter(
    (r) =>
      r.status === "PENDING" ||
      (r.status === "MATCHED" && !r.assignedDriverId)
  );
};

/**
 * Requests assigned to a specific driver.
 */
export const listRequestsForDriver = (
  driverId: OtwDriverId
): OtwRequest[] => {
  return requestStore
    .filter((r) => r.assignedDriverId === driverId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );
};

/**
 * Assign a request to a driver (from open pool).
 */
export const assignRequestToDriver = (
  requestId: OtwRequestId,
  driverId: OtwDriverId
): Result<OtwRequest> => {
  const request = requestStore.find((r) => r.id === requestId);
  if (!request) return err("Request not found.");
  if (request.assignedDriverId && request.assignedDriverId !== driverId) {
    return err("Request is already assigned to another driver.");
  }
  request.assignedDriverId = driverId;
  request.status = "MATCHED";
  request.updatedAt = new Date().toISOString();
  return ok(request);
};

/**
 * Driver accepts an assigned request.
 */
export const driverAcceptRequest = (
  requestId: OtwRequestId,
  driverId: OtwDriverId
): Result<OtwRequest> => {
  const request = requestStore.find((r) => r.id === requestId);
  if (!request) return err("Request not found.");
  if (request.assignedDriverId && request.assignedDriverId !== driverId) {
    return err("Request is assigned to a different driver.");
  }
  request.assignedDriverId = driverId;
  request.status = "ACCEPTED";
  request.acceptedAtIso = new Date().toISOString();
  request.updatedAt = new Date().toISOString();
  return ok(request);
};

/**
 * Driver marks a request as completed.
 */
export const driverCompleteRequest = (
  requestId: OtwRequestId,
  driverId: OtwDriverId
): Result<OtwRequest> => {
  const request = requestStore.find((r) => r.id === requestId);
  if (!request) return err("Request not found.");
  if (request.assignedDriverId !== driverId) {
    return err("Request is not assigned to this driver.");
  }
  request.status = "COMPLETED";
  request.completedAtIso = new Date().toISOString();
  request.chargedMiles = request.estimatedMiles;
  request.updatedAt = new Date().toISOString();
  // Update driver stats (ignore error for now in MVP)
  recordDriverCompletedJob(driverId);
  // Award NIP Coin rewards for this completion
  const nipOutcome = awardNipForCompletedRequest(request);
  if (nipOutcome.errors && nipOutcome.errors.length > 0) {
    console.warn("NIP reward issues for request", request.id, nipOutcome.errors);
  }
  return ok(request);
};
