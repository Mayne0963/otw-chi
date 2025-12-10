// lib/otw/otwTypes.ts

import type { OtwTierId, OtwCustomerId, OtwDriverId, OtwCityId, OtwZoneId } from './otwIds';
export type { OtwTierId, OtwCustomerId, OtwDriverId, OtwCityId, OtwZoneId } from './otwIds';
import type { ServiceType, OtwRequestStatus } from './otwEnums';
export type { ServiceType } from './otwEnums';

// Request status type is imported from otwEnums

// Driver's current live status in the system.
export type DriverCurrentStatus =
  | "OFFLINE"
  | "IDLE"
  | "ON_JOB"
  | "UNAVAILABLE";

// Internal driver tier for ranking and incentives.
export type DriverTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

// Customer membership tiers – this will align with your mileage plans.
export type MembershipTierId =
  | "BASIC"
  | "BADAZZ"
  | "ELITE";

// Generic location representation (lat/lng + optional label).
export interface OtwLocation {
  lat: number;
  lng: number;
  label?: string; // e.g. "Home", "Best Buy South", "Office"
}

// Basic shape of a customer in the OTW universe.
export interface OtwCustomerProfile {
  customerId: string;
  displayName: string;
  email?: string;
  phone?: string;
  defaultPickupLocation?: OtwLocation;
  defaultDropoffLocation?: OtwLocation;

  // Soft delete / status
  isActive: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO

  // Future: NIP balance, referral codes, etc.
}

// Basic shape of a driver profile.
export interface OtwDriverProfile {
  driverId: string;
  displayName: string;
  phone?: string;
  email?: string;
  baseZone: string;

  status: DriverCurrentStatus;
  tier: DriverTier;

  // Performance metrics
  completedJobs: number;
  cancelledJobs: number;
  avgRating: number; // 0–5
  lastActiveAt: string | null; // ISO

  // NEW: geography
  homeCityId?: OtwCityId;
  primaryZoneId?: OtwZoneId;
  allowedZoneIds?: OtwZoneId[];

  // Franchise-related metadata (will be computed later)
  franchiseScore?: number;
  franchiseRank?:
    | "NOT_ELIGIBLE"
    | "SEED"
    | "BRONZE"
    | "SILVER"
    | "GOLD"
    | "PLATINUM"
    | "EMPIRE";
  franchiseEligible?: boolean;
  franchiseLastEvaluatedAt?: string | null; // ISO
}

// Membership summary for a customer.
export interface OtwMembershipSummary {
  customerId: string;
  tierId: MembershipTierId;
  // "Mileage" here is your internal OTW miles, not literal miles.
  includedMiles: number; // monthly allocated
  milesUsedThisPeriod: number;
  periodStart: string; // ISO
  periodEnd: string; // ISO;

  isActive: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO;
}

// Core representation of an OTW request.
export interface OtwRequest {
  id: string;
  customerId: string;
  serviceType: ServiceType;
  status: OtwRequestStatus;

  // NEW: geographic tagging
  cityId?: OtwCityId;
  zoneId?: OtwZoneId;

  // Driver linkage (optional until assigned)
  assignedDriverId?: string;

  // Mileage / costing
  estimatedMiles: number; // computed OTW miles
  estimatedDistanceKm?: number; // real distance (approx)
  estimatedDurationMinutes?: number; // time estimate
  chargedMiles?: number;

  // Locations
  pickupLocation?: OtwLocation;
  dropoffLocation?: OtwLocation;

  // Optional descriptions from customer
  notes?: string;

  // Timestamps
  createdAt: string; // ISO
  updatedAt: string; // ISO
  assignedAt?: string; // ISO
  acceptedAtIso?: string; // ISO
  completedAt?: string; // ISO
  completedAtIso?: string; // ISO
  cancelledAt?: string; // ISO

  // Future: pricing, tips, NIP rewards, etc.
}

// Simple rating shape for post-completion feedback.
export interface OtwRating {
  requestId: string;
  customerId: string;
  driverId: string;
  score: number; // 1–5
  comment?: string;
  createdAt: string; // ISO
}

// Tier definition used by the Tier Catalog and Membership Engine.
export interface OtwTierDefinition {
  id: OtwTierId;
  name: string;
  description: string;
  monthlyPriceCents: number;
  includedMiles: number;
  perks: string[];
  // Optional constraint fields
  maxMilesPerRequest?: number;
  allowedServiceTypes?: ServiceType[];
  recommendedUpgradeTierId?: OtwTierId;
}

// Lightweight membership record for a customer.
export interface OtwMembership {
  customerId: OtwCustomerId;
  tierId: OtwTierId;
  activeSinceIso: string; // ISO
  renewsAtIso?: string; // ISO
  milesRemaining: number;
  status: 'ACTIVE' | 'CANCELLED';
  // Optional extended fields for richer membership handling
  membershipId?: string;
  milesCap?: number;
  milesUsed?: number;
  rolloverMiles?: number;
  renewsOn?: string; // ISO date (alias of renewsAtIso)
  createdAt?: string; // ISO date (alias of activeSinceIso)
}

// NIP Coin wallet and ledger entities (minimal MVP)
export interface NipWallet {
  ownerCustomerId?: OtwCustomerId;
  ownerDriverId?: OtwDriverId;
  balance: number;
  totalEarned: number;
}

export interface NipLedgerEntry {
  id: string; // OtwLedgerId
  createdAt: string; // ISO
  ownerCustomerId?: OtwCustomerId;
  ownerDriverId?: OtwDriverId;
  delta: number; // positive credits; negative allowed internally
  reason: string;
  meta?: Record<string, unknown>;
}

// Shared lightweight types for UI components
export type Urgency = "NORMAL" | "PRIORITY" | "RUSH";

export type JobType = "MOVE" | "EXCHANGE" | "HAUL" | "PRESENCE" | "BUSINESS";

export type JobStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export type DriverStatus = "ONLINE" | "OFFLINE";

export interface ServiceConfig {
  id: ServiceType;
  title: string;
  subtitle: string;
}

export interface DriverJob {
  id: string;
  type: JobType;
  label: string;
  payout: number;
  status: JobStatus;
  etaMinutes?: number;
}

// Feedback & Reputation
export type FeedbackRater = "CUSTOMER" | "SYSTEM";

export interface OtwFeedback {
  id: string;
  requestId: string;
  driverId: string;
  customerId: string;
  rater: FeedbackRater;
  rating: number; // 1–5
  comment?: string;
  createdAt: string; // ISO
}

export interface OtwDriverReputationSummary {
  driverId: string;
  avgRating: number;
  totalRatings: number;
  lastFeedback?: OtwFeedback;
}

export interface OtwCustomerReputationSummary {
  customerId: string;
  avgRatingGiven: number;
  totalRatingsGiven: number;
}

// Matching & Driver scoring
export interface OtwMatchContext {
  requestId: string;
  serviceType: ServiceType;
  urgency: Urgency;
  pickupArea: string;
  dropoffArea: string;
}

export interface OtwDriverMatchScore {
  driver: OtwDriverProfile;
  score: number;
  factors: {
    zoneAffinity: number;
    ratingBoost: number;
    workloadPenalty: number;
    statusPenalty: number;
    urgencyBoost: number;
  };
}

// Membership additions
export type MembershipStatus = "ACTIVE" | "PAST_DUE" | "CANCELLED" | "TRIAL";
