import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DriverTier } from '@prisma/client';

// Security: Verify Cron Secret
const CRON_SECRET = process.env.CRON_SECRET;

interface DriverPerformanceMetrics {
  avgRatingRolling: number;
  onTimeRateRolling: number; // 0.0 to 1.0
  completedJobs: number;
  cancelRateRolling: number; // 0.0 to 1.0
  flagsCount: number;
}

const TIER_CONFIG = {
  [DriverTier.PROBATION]: {
    hourlyRateCents: 1500, // $15.00
    bonusEnabled: false,
    bonus5StarCents: 0,
  },
  [DriverTier.STANDARD]: {
    hourlyRateCents: 2000, // $20.00
    bonusEnabled: true,
    bonus5StarCents: 200, // $2.00
  },
  [DriverTier.ELITE]: {
    hourlyRateCents: 2500, // $25.00
    bonusEnabled: true,
    bonus5StarCents: 500, // $5.00
  },
  [DriverTier.CONCIERGE]: {
    hourlyRateCents: 3500, // $35.00
    bonusEnabled: true,
    bonus5StarCents: 1000, // $10.00
  },
};

export async function GET(req: Request) {
  // 1. Auth Check
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 2. Fetch all drivers
    const drivers = await prisma.driverProfile.findMany();
    const updates = [];

    for (const driver of drivers) {
      // 3. Parse Metrics
      const metrics = (driver.performanceMetrics as unknown as DriverPerformanceMetrics) || {
        avgRatingRolling: 0,
        onTimeRateRolling: 0,
        completedJobs: 0,
        cancelRateRolling: 0,
        flagsCount: 0,
      };

      // 4. Calculate Score
      // score = avgRatingRolling * 50 + onTimeRateRolling * 40 - cancelRateRolling * 30 - flagsCount * 10
      // Note: onTimeRate and cancelRate are assumed 0-1 based on typical rolling metrics.
      // If they are percentages (0-100), the weights might need adjustment. 
      // Prompt says "90% on-time", usually implies 0.90 or 90.
      // Let's assume 0.0 - 1.0 for rates to keep math standard, or if inputs are 0-100 we adjust.
      // "onTimeRateRolling * 40" -> if 0.9, that's 36. If 90, that's 3600.
      // "avgRatingRolling * 50" -> if 4.8, that's 240.
      // It seems weights are balanced for small numbers. Let's assume:
      // Rating: 0-5
      // Rates: 0-1
      // Flags: integer count
      
      const score = 
        (metrics.avgRatingRolling || 0) * 50 + 
        (metrics.onTimeRateRolling || 0) * 40 - 
        (metrics.cancelRateRolling || 0) * 30 - 
        (metrics.flagsCount || 0) * 10;

      // 5. Determine Tier
      // CONCIERGE is manual only. Skip if already CONCIERGE.
      let newTier = driver.tierLevel;

      if (driver.tierLevel !== DriverTier.CONCIERGE) {
        // Evaluate for ELITE
        // 150 jobs, 4.9⭐, 95% on-time
        if (
          metrics.completedJobs >= 150 &&
          metrics.avgRatingRolling >= 4.9 &&
          metrics.onTimeRateRolling >= 0.95
        ) {
          newTier = DriverTier.ELITE;
        }
        // Evaluate for STANDARD
        // 50 jobs, 4.8⭐, 90% on-time
        else if (
          metrics.completedJobs >= 50 &&
          metrics.avgRatingRolling >= 4.8 &&
          metrics.onTimeRateRolling >= 0.90
        ) {
          // Downgrade protection? Prompt doesn't specify. Assuming strict weekly re-eval.
          newTier = DriverTier.STANDARD;
        } else {
          // Default to PROBATION if criteria not met
          newTier = DriverTier.PROBATION;
        }
      }

      // 6. Update Profile if Changed
      // Also update score regardless
      if (newTier !== driver.tierLevel || true) { // Always update to save score/rates
        const config = TIER_CONFIG[newTier];
        
        updates.push(
          prisma.driverProfile.update({
            where: { id: driver.id },
            data: {
              tierLevel: newTier,
              hourlyRateCents: config.hourlyRateCents,
              bonusEnabled: config.bonusEnabled,
              bonus5StarCents: config.bonus5StarCents,
              // Save score in metrics JSON? Prompt says "Save performanceScore".
              // Let's append it to the metrics JSON.
              performanceMetrics: {
                ...metrics,
                performanceScore: score,
                lastEvaluatedAt: new Date(),
              } as any,
            },
          })
        );
      }
    }

    // 7. Execute Batch Updates
    await prisma.$transaction(updates);

    return NextResponse.json({
      success: true,
      processed: drivers.length,
      updated: updates.length,
    });

  } catch (error) {
    console.error('Driver Tier Cron Failed:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
