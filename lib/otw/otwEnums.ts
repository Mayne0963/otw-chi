// lib/otw/otwEnums.ts

// High-level service types that OTW supports.
export type ServiceType =
  | 'ERRAND' // store run, forgotten items, groceries
  | 'FOOD' // restaurant + Broski’s Kitchen runs
  | 'BIG_HAUL' // TV, appliances, large items
  | 'DOCUMENT' // paperwork, envelopes
  | 'VIP' // special handling, white-glove
  | 'OTHER';

// OTW request status lifecycle values.
export type OtwRequestStatus =
  | 'PENDING'
  | 'MATCHED'
  | 'ACCEPTED'
  | 'EN_ROUTE_PICKUP'
  | 'ARRIVED_PICKUP'
  | 'EN_ROUTE_DROPOFF'
  | 'COMPLETED'
  | 'CANCELLED';

// Driver status and tier enums
export type DriverCurrentStatus = 'OFFLINE' | 'IDLE' | 'ON_JOB' | 'UNAVAILABLE';
export type DriverTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
