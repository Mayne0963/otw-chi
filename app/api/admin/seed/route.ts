import { NextResponse } from 'next/server';
import { getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UNLIMITED_SERVICE_MILES } from '@/lib/membership-miles';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(_request: Request) {
  try {
    // Check authentication
    const session = await getNeonSession();
    // @ts-ignore
    const userId = session?.userId || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await requireRole(['ADMIN']);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.warn('[Seed] Starting database seed... v1.1');
    
    const prisma = getPrisma();
    
    // Seed Cities
    console.warn('[Seed] Seeding cities...');
    
    const seedCity = async (name: string) => {
      try {
        const existing = await prisma.city.findUnique({
          where: { name }
        });
        
        if (existing) {
          return existing;
        } else {
          return prisma.city.create({
            data: { name }
          });
        }
      } catch (e) {
        console.error(`[Seed] Failed to seed city ${name}:`, e);
        throw e;
      }
    };

    const chicago = await seedCity('Chicago');
    console.warn('[Seed] City Chicago seeded');

    const fortWayne = await seedCity('Fort Wayne');
    console.warn('[Seed] City Fort Wayne seeded');

    // console.log(`[Seed] ✓ Created cities: ${chicago.name}, ${fortWayne.name}`);

    // Seed Zones for Chicago
    console.warn('[Seed] Seeding zones...');
    
    const seedZone = async (name: string, cityId: string) => {
      // Find existing zone by name/city (avoids ID validation issues)
      const existing = await prisma.zone.findFirst({
        where: { name, cityId }
      });
      
      if (existing) {
        // Return existing record (safe even if ID is non-standard)
        return existing;
      } else {
        // Create new record with auto-generated CUID
        return prisma.zone.create({
          data: { name, cityId }
        });
      }
    };

    const southSide = await seedZone('South Side', chicago.id);
    console.warn('[Seed] Zone South Side seeded');

    const westSide = await seedZone('West Side', chicago.id);

    const downtown = await seedZone('Downtown', chicago.id);

    // Seed Zones for Fort Wayne
    const northOTW = await seedZone('North OTW', fortWayne.id);

    const southOTW = await seedZone('South OTW', fortWayne.id);

    const eastOTW = await seedZone('East OTW', fortWayne.id);

    const westOTW = await seedZone('West OTW', fortWayne.id);

    // console.log(`[Seed] ✓ Created zones: ${southSide.name}, ${westSide.name}, ${downtown.name}, ${northOTW.name}, ${southOTW.name}, ${eastOTW.name}, ${westOTW.name}`);

    type SeedPlan = {
      name: string;
      description: string;
      stripeEnvKey?: string;
      publicMonthlyPriceCents?: number;
      includedUsers?: number;
      monthlyServiceMiles: number;
      rolloverCapMiles: number;
      advanceDiscountMax: number;
      priorityLevel: number;
      markupFree: boolean;
      cashAllowed: boolean;
      peerToPeerAllowed: boolean;
      allowedServiceTypes: readonly string[] | null;
    };

    const plansToUpsert: SeedPlan[] = [
      {
        name: 'OTW BASIC',
        description: 'Best for food, groceries, and quick errands.',
        stripeEnvKey: 'price_1Su3BtDcrdanf6e5Wz2uczBC',
        publicMonthlyPriceCents: 9900,
        monthlyServiceMiles: 60,
        rolloverCapMiles: 0,
        advanceDiscountMax: 0,
        priorityLevel: 0,
        markupFree: false,
        cashAllowed: false,
        peerToPeerAllowed: false,
        allowedServiceTypes: ['FOOD', 'STORE'],
      },
      {
        name: 'OTW PLUS',
        description: 'More miles for multi-stop runs, longer waits, and light priority.',
        stripeEnvKey: 'price_1Su3DKDcrdanf6e5NsBJmYw8',
        publicMonthlyPriceCents: 16900,
        monthlyServiceMiles: 120,
        rolloverCapMiles: 30,
        advanceDiscountMax: 0,
        priorityLevel: 1,
        markupFree: false,
        cashAllowed: false,
        peerToPeerAllowed: false,
        allowedServiceTypes: ['FOOD', 'STORE'],
      },
      {
        name: 'OTW PRO',
        description: 'Most popular. Markup-free requests with priority routing.',
        stripeEnvKey: 'price_1Su3EQDcrdanf6e5ZXBOzaRd',
        publicMonthlyPriceCents: 26900,
        monthlyServiceMiles: 200,
        rolloverCapMiles: 75,
        advanceDiscountMax: 0,
        priorityLevel: 2,
        markupFree: true,
        cashAllowed: false,
        peerToPeerAllowed: false,
        allowedServiceTypes: ['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE'],
      },
      {
        name: 'OTW ELITE',
        description: 'Cash handling and peer-to-peer delivery included.',
        stripeEnvKey: 'price_1Su3FZDcrdanf6e5bywNpGWD',
        publicMonthlyPriceCents: 42900,
        monthlyServiceMiles: 350,
        rolloverCapMiles: 150,
        advanceDiscountMax: 0,
        priorityLevel: 3,
        markupFree: true,
        cashAllowed: true,
        peerToPeerAllowed: true,
        allowedServiceTypes: ['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE'],
      },
      {
        name: 'OTW BLACK',
        description: 'Concierge tier with unlimited rollover and priority support.',
        stripeEnvKey: 'price_1Su3H8Dcrdanf6e51pTmditF',
        publicMonthlyPriceCents: 69900,
        monthlyServiceMiles: 600,
        rolloverCapMiles: UNLIMITED_SERVICE_MILES,
        advanceDiscountMax: 0,
        priorityLevel: 4,
        markupFree: true,
        cashAllowed: true,
        peerToPeerAllowed: true,
        allowedServiceTypes: ['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE'],
      },
      {
        name: 'OTW BUSINESS CORE',
        description: 'Monthly invoice billing. For offices, clinics, dealers, and realtors.',
        publicMonthlyPriceCents: 69900,
        includedUsers: 5,
        monthlyServiceMiles: 500,
        rolloverCapMiles: 250,
        advanceDiscountMax: 0,
        priorityLevel: 5,
        markupFree: true,
        cashAllowed: true,
        peerToPeerAllowed: true,
        allowedServiceTypes: ['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE'],
      },
      {
        name: 'OTW BUSINESS PRO',
        description: 'Monthly invoice billing with priority dispatch and a dedicated rep.',
        publicMonthlyPriceCents: 119900,
        includedUsers: 15,
        monthlyServiceMiles: 1000,
        rolloverCapMiles: 500,
        advanceDiscountMax: 0,
        priorityLevel: 6,
        markupFree: true,
        cashAllowed: true,
        peerToPeerAllowed: true,
        allowedServiceTypes: ['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE'],
      },
      {
        name: 'OTW ENTERPRISE',
        description: 'Custom pricing with SLA contracts, guaranteed response times, and multi-location support.',
        monthlyServiceMiles: 0,
        rolloverCapMiles: 0,
        advanceDiscountMax: 0,
        priorityLevel: 7,
        markupFree: true,
        cashAllowed: true,
        peerToPeerAllowed: true,
        allowedServiceTypes: ['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE'],
      },
    ];

    const upsertedPlans = [] as string[];
    for (const plan of plansToUpsert) {
      const stripePriceId = plan.stripeEnvKey ? process.env[plan.stripeEnvKey] || null : null;
      if (plan.publicMonthlyPriceCents && plan.monthlyServiceMiles > 0) {
        const effectiveCents = plan.publicMonthlyPriceCents / plan.monthlyServiceMiles;
        if (effectiveCents < 110) {
          throw new Error(`Plan ${plan.name} violates Service Mile floor`);
        }
      }

      const existingPlan = await prisma.membershipPlan.findUnique({
        where: { name: plan.name }
      });

      let record;
      const planData = {
        description: plan.description,
        stripePriceId,
        monthlyServiceMiles: plan.monthlyServiceMiles,
        rolloverCapMiles: plan.rolloverCapMiles,
        advanceDiscountMax: plan.advanceDiscountMax,
        priorityLevel: plan.priorityLevel,
        markupFree: plan.markupFree,
        cashAllowed: plan.cashAllowed,
        peerToPeerAllowed: plan.peerToPeerAllowed,
        allowedServiceTypes: (plan.allowedServiceTypes ?? undefined) as Prisma.InputJsonValue | undefined,
      };

      if (existingPlan) {
        record = await prisma.membershipPlan.update({
          where: { id: existingPlan.id },
          data: planData
        });
      } else {
        record = await prisma.membershipPlan.create({
          data: {
            name: plan.name,
            ...planData
          }
        });
      }

      upsertedPlans.push(record.name);
    }

    console.warn(`[Seed] ✓ Upserted membership plans: ${upsertedPlans.join(', ')}`);

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully (v1.1)',
      data: {
        cities: [chicago.name, fortWayne.name],
        zones: [southSide.name, westSide.name, downtown.name, northOTW.name, southOTW.name, eastOTW.name, westOTW.name],
        plans: upsertedPlans,
        version: '1.1'
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error('[Seed] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
        details: String(error),
      },
      { status: 500 }
    );
  }
}
