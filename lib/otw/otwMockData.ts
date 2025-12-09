import { DriverJob, DriverStatus, ServiceType } from "./otwTypes";

export interface OtwCustomerSnapshot {
  userName: string;
  tier: string;
  monthlyMilesCap: number;
  milesUsed: number;
  rolloverMiles: number;
  jobsCompletedThisMonth: number;
  avgMilesPerJob: number;
}

export interface OtwRecentActivityItem {
  id: string;
  serviceType: ServiceType;
  label: string;
  miles: number;
  status: "Delivered" | "In Progress" | "Cancelled";
  date: string;
}

export const mockCustomerSnapshot: OtwCustomerSnapshot = {
  userName: "Big’um",
  tier: "Badazz Move",
  monthlyMilesCap: 20000,
  milesUsed: 3120,
  rolloverMiles: 1500,
  jobsCompletedThisMonth: 42,
  avgMilesPerJob: 480,
};

export const mockRecentActivity: OtwRecentActivityItem[] = [
  {
    id: "R1",
    serviceType: "ERRAND",
    label: "Grocery Move – Coldwater → Lima",
    miles: 540,
    status: "Delivered",
    date: "2025-11-15",
  },
  {
    id: "R2",
    serviceType: "DOCUMENT",
    label: "Backpack to South Side High",
    miles: 320,
    status: "Delivered",
    date: "2025-11-16",
  },
  {
    id: "R3",
    serviceType: "BIG_HAUL",
    label: "65\" TV – Best Buy pickup",
    miles: 980,
    status: "Delivered",
    date: "2025-11-17",
  },
  {
    id: "R4",
    serviceType: "VIP",
    label: "Wait for Internet Tech (2 hrs)",
    miles: 760,
    status: "Delivered",
    date: "2025-11-18",
  },
];

export interface OtwDriverSnapshot {
  driverId: string;
  driverName: string;
  driverTier: string;
  rating: number;
  jobsToday: number;
  earningsToday: number;
  weeklyEarnings: number;
  initialStatus: DriverStatus;
}

export const mockDriverSnapshot: OtwDriverSnapshot = {
  driverId: "DRIVER-1",
  driverName: "OTW Rep Big’um",
  driverTier: "Purple – OTW Specialist",
  rating: 4.9,
  jobsToday: 7,
  earningsToday: 186.5,
  weeklyEarnings: 720.25,
  initialStatus: "ONLINE",
};

export const mockDriverJobsToday: DriverJob[] = [
  {
    id: "J1",
    type: "MOVE",
    label: "Grocery run – Coldwater → Lima",
    payout: 18.5,
    status: "COMPLETED",
  },
  {
    id: "J2",
    type: "EXCHANGE",
    label: "Backpack to school",
    payout: 12,
    status: "COMPLETED",
  },
  {
    id: "J3",
    type: "HAUL",
    label: "88\" TV + washer from Best Buy",
    payout: 64.5,
    status: "IN_PROGRESS",
    etaMinutes: 15,
  },
];
