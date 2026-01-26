import { prisma } from './db';
import {
  acceptDeliveryRequest as acceptDeliveryRequestCore,
  completeDeliveryRequest as completeDeliveryRequestCore,
  markDriverArrived as markDriverArrivedCore,
} from './driver-lifecycle-core';

export async function acceptDeliveryRequest(requestId: string, driverId: string) {
  return await acceptDeliveryRequestCore(requestId, driverId, prisma);
}

export async function markDriverArrived(requestId: string, driverId: string) {
  return await markDriverArrivedCore(requestId, driverId, prisma);
}

export async function completeDeliveryRequest(requestId: string, driverId: string) {
  return await completeDeliveryRequestCore(requestId, driverId, prisma);
}
