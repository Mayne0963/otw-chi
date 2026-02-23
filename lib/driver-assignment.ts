import { DeliveryRequestStatus } from '@prisma/client';

export const DRIVER_ACTIVE_REQUEST_STATUSES: DeliveryRequestStatus[] = [
  DeliveryRequestStatus.ASSIGNED,
  DeliveryRequestStatus.PICKED_UP,
  DeliveryRequestStatus.EN_ROUTE,
];
