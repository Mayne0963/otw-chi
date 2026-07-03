import { OtwLocation } from "./otwTypes";

export interface OtwDriverLocation {
  driverId: string;
  label?: string;
  location: OtwLocation;
  updatedAt: string; // ISO
  currentRequestId?: string;
}
