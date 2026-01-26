import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DriverTier } from '@prisma/client';

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

function toNumber(value: unknown, fallback: number) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function normalizeRate(value: unknown) {
  const raw = toNumber(value, 0);
  const asFraction = raw > 1 ? raw / 100 : raw;
  return Math.max(0, Math.min(1, asFraction));
}

function getMetrics(rawMetrics: unknown): DriverPerformanceMetrics {
  const m = (rawMetrics ?? {}) as Record<string, unknown>;
  return {
    avgRatingRolling: toNumber(m.avgRatingRolling, 0),
    onTimeRateRolling: normalizeRate(m.onTimeRateRolling),
    completedJobs: Math.max(0, Math.floor(toNumber(m.completedJobs, 0))),
    cancelRateRolling: normalizeRate(m.cancelRateRolling),
    flagsCount: Math.max(0, Math.floor(toNumber(m.flagsCount, 0))),
  };
}

export async function GET(req: Request) {
  if (!CRON_SECRET) {
    return new NextResponse('Cron secret not configured', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const drivers = await prisma.driverProfile.findMany({
      select: { id: true, tierLevel: true, performanceMetrics: true },
    });
    const batchSize = 200;
    let updated = 0;

    for (let i = 0; i < drivers.length; i += batchSize) {
      const batch = drivers.slice(i, i + batchSize);
      const updates = [];

      for (const driver of batch) {
        const metrics = getMetrics(driver.performanceMetrics);

        const score =
          (metrics.avgRatingRolling || 0) * 50 +
          (metrics.onTimeRateRolling || 0) * 40 -
          (metrics.cancelRateRolling || 0) * 30 -
          (metrics.flagsCount || 0) * 10;

        let newTier = driver.tierLevel;

        if (driver.tierLevel !== DriverTier.CONCIERGE) {
          if (
            metrics.completedJobs >= 150 &&
            metrics.avgRatingRolling >= 4.9 &&
            metrics.onTimeRateRolling >= 0.95
          ) {
            newTier = DriverTier.ELITE;
          } else if (
            metrics.completedJobs >= 50 &&
            metrics.avgRatingRolling >= 4.8 &&
            metrics.onTimeRateRolling >= 0.9
          ) {
            newTier = DriverTier.STANDARD;
          } else {
            newTier = DriverTier.PROBATION;
          }
        }

        const config = TIER_CONFIG[newTier];

        updates.push(
          prisma.driverProfile.update({
            where: { id: driver.id },
            data: {
              tierLevel: newTier,
              hourlyRateCents: config.hourlyRateCents,
              bonusEnabled: config.bonusEnabled,
              bonus5StarCents: config.bonus5StarCents,
              performanceMetrics: {
                ...metrics,
                performanceScore: score,
                lastEvaluatedAt: new Date(),
              } as any,
            },
          })
        );
      }

      if (updates.length > 0) {
        await prisma.$transaction(updates);
        updated += updates.length;
      }
    }

    return NextResponse.json({
      success: true,
      processed: drivers.length,
      updated,
    });

  } catch (error) {
    console.error('Driver Tier Cron Failed:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
