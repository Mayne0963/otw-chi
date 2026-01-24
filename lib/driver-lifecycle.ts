import { prisma } from './db';
import { DeliveryRequestStatus, DriverEarningStatus } from '@prisma/client';

/**
 * 1. Driver Accepts Request
 * - Updates status to ASSIGNED
 * - Sets assignedAt timestamp
 * - Links driver to request
 */
export async function acceptDeliveryRequest(requestId: string, driverId: string) {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.deliveryRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new Error('Request not found');
    if (request.status !== DeliveryRequestStatus.REQUESTED) {
      throw new Error('Request is not available for acceptance');
    }

    return await tx.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: DeliveryRequestStatus.ASSIGNED,
        assignedDriverId: driverId,
        assignedAt: new Date(),
      },
    });
  });
}

/**
 * 2. Driver Arrives at Pickup/Location
 * - Updates status to PICKED_UP (or EN_ROUTE depending on flow, but "Arrived" usually starts the clock)
 * - Sets arrivedAt timestamp
 * - CREATES DriverTimeLog (Clock-in for pay)
 */
export async function markDriverArrived(requestId: string, driverId: string) {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.deliveryRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new Error('Request not found');
    if (request.assignedDriverId !== driverId) throw new Error('Not assigned to this driver');
    if (request.arrivedAt) throw new Error('Driver already marked arrived');

    // Update Request
    const updatedRequest = await tx.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: DeliveryRequestStatus.PICKED_UP, // Assuming "Arrived" implies pickup phase started
        arrivedAt: new Date(),
      },
    });

    // Start Time Log
    await tx.driverTimeLog.create({
      data: {
        driverId,
        deliveryRequestId: requestId,
        startTime: new Date(),
      },
    });

    return updatedRequest;
  });
}

/**
 * 3. Driver Completes Request
 * - Updates status to DELIVERED
 * - Sets completedAt timestamp
 * - Closes Time Log & Computes Active Minutes
 * - Calculates Pay & Creates Earnings Record
 */
export async function completeDeliveryRequest(requestId: string, driverId: string) {
  return await prisma.$transaction(async (tx) => {
    // Fetch Request & Driver Profile
    const request = await tx.deliveryRequest.findUnique({
      where: { id: requestId },
      include: {
        timeLogs: {
          where: { driverId, endTime: null }, // Find open log
        },
      },
    });

    const driver = await tx.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true } // Need user ID for earnings relation if needed (schema says DriverEarnings links to user via driverId?)
      // Wait, schema says: driverId String, user User @relation... 
      // Actually DriverEarnings model: driverId String ... user User @relation(fields: [driverId], references: [id])
      // This implies driverId in Earnings IS the User ID.
      // But DriverProfile.id is usually CUID. DriverProfile.userId is the User ID.
      // Let's check schema for DriverEarnings relation.
      // model DriverEarnings { driverId String ... user User @relation(fields: [driverId], references: [id]) }
      // The relation references User.id. So 'driverId' in Earnings table MUST be a User ID.
      // We need driver.userId.
    });

    if (!request) throw new Error('Request not found');
    if (!driver) throw new Error('Driver not found');
    if (request.assignedDriverId !== driverId) throw new Error('Not assigned to this driver');
    if (!request.arrivedAt) throw new Error('Cannot complete before arriving');
    if (request.status === DeliveryRequestStatus.DELIVERED) throw new Error('Already completed');

    // 1. Close Time Log
    const openLog = request.timeLogs[0];
    if (!openLog) throw new Error('No active time log found for pay calculation');

    const now = new Date();
    const durationMs = now.getTime() - openLog.startTime.getTime();
    const activeMinutes = Math.ceil(durationMs / (1000 * 60)); // Round up minutes

    await tx.driverTimeLog.update({
      where: { id: openLog.id },
      data: {
        endTime: now,
        activeMinutes,
      },
    });

    // 2. Calculate Pay
    // hourlyPay = (activeMinutes / 60) * hourlyRateCents
    const hourlyPayCents = Math.floor((activeMinutes / 60) * driver.hourlyRateCents);
    
    // Check Bonus Eligibility
    // Bonus only if: customerRating === 5 AND complaintFlag === false AND driver.bonusEnabled === true
    // NOTE: Customer rating usually comes AFTER completion. 
    // If we pay immediately, we can't include performance bonus yet.
    // However, prompt says: "Bonus only if: customerRating === 5..."
    // This implies pay calculation might happen LATER or we assume 5 until rated?
    // Usually, "Complete" is the driver action. Rating is the customer action.
    // If we must calculate pay NOW, we can calculate base pay. Bonus might need a separate trigger.
    // BUT, the prompt says "calculate pay + bonus" in the "Complete" step.
    // This suggests we might have the rating already? Unlikely for a "Driver Action".
    // OR, maybe this is a "System Process" that runs after rating?
    // The prompt title is "DRIVER FLOW + PAYOUT ENGINE".
    // Let's assume for this step we calculate BASE PAY. 
    // IF the prompt implies instant bonus, we can't do it without a rating.
    // Let's look at the constraints: "bonusPay = bonus5StarCents if eligible".
    // If rating is null, we can't give 5-star bonus.
    // We will calculate Base Pay here. Bonus might need to be a separate adjustment or we assume 0 for now.
    // ALTERNATIVELY: Maybe the system auto-rates 5 if no complaint?
    // Let's implement Base Pay + potential Bonus if rating exists (e.g. strict flow).
    // If rating is missing, bonus is 0.
    
    let bonusPayCents = 0;
    if (request.customerRating === 5 && !request.complaintFlag && driver.bonusEnabled) {
        bonusPayCents = driver.bonus5StarCents;
    }

    const totalPayCents = hourlyPayCents + bonusPayCents;

    // 3. Create Earnings Record
    // Relation Fix: driverId in Earnings references User.id.
    await tx.driverEarnings.create({
      data: {
        driverId: driver.userId, // Linking to User ID as per schema relation
        amount: totalPayCents, // Legacy field (int) - maybe cents? Schema has amount AND amountCents.
        amountCents: totalPayCents,
        status: DriverEarningStatus.pending, // Pending until payout cycle?
        requestId: request.id,
      },
    });

    // 4. Update Request Status
    const updatedRequest = await tx.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: DeliveryRequestStatus.DELIVERED,
        completedAt: now,
      },
    });
    
    // 5. Increment Stats (using JSON update for flexibility or simple query?)
    // DriverProfile has 'performanceMetrics' JSON. 
    // We probably want to handle stats aggregation asynchronously or simply here.
    // Let's strictly follow the prompt "increment driver.completedJobs". 
    // But 'completedJobs' is not a direct column on DriverProfile in the provided schema (it's in the JSON or missing).
    // The provided schema shows 'performanceMetrics Json?'.
    // I will read the JSON, increment, and write back.
    
    const metrics = (driver.performanceMetrics as any) || { completedJobs: 0 };
    metrics.completedJobs = (metrics.completedJobs || 0) + 1;

    await tx.driverProfile.update({
        where: { id: driverId },
        data: {
            performanceMetrics: metrics
        }
    });

    return {
        request: updatedRequest,
        pay: {
            activeMinutes,
            hourlyPayCents,
            bonusPayCents,
            totalPayCents
        }
    };
  });
}
