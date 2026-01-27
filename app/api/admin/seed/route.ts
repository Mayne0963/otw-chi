import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { UNLIMITED_SERVICE_MILES } from '@/lib/membership-miles';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(_request: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await requireRole(['ADMIN']);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // console.log('[Seed] Starting database seed...');
    
    const prisma = getPrisma();
    
    // Seed Cities
    // console.log('[Seed] Seeding cities...');
    const chicago = await prisma.city.upsert({
      where: { name: 'Chicago' },
      update: {},
      create: {
        name: 'Chicago',
      },
    });

    const fortWayne = await prisma.city.upsert({
      where: { name: 'Fort Wayne' },
      update: {},
      create: {
        name: 'Fort Wayne',
      },
    });

    // console.log(`[Seed] ✓ Created cities: ${chicago.name}, ${fortWayne.name}`);

    // Seed Zones for Chicago
    // console.log('[Seed] Seeding zones...');
    const southSide = await prisma.zone.upsert({
      where: { id: 'south-side' },
      update: { name: 'South Side', cityId: chicago.id },
      create: {
        id: 'south-side',
        name: 'South Side',
        cityId: chicago.id,
      },
    });

    const westSide = await prisma.zone.upsert({
      where: { id: 'west-side' },
      update: { name: 'West Side', cityId: chicago.id },
      create: {
        id: 'west-side',
        name: 'West Side',
        cityId: chicago.id,
      },
    });

    const downtown = await prisma.zone.upsert({
      where: { id: 'downtown' },
      update: { name: 'Downtown', cityId: chicago.id },
      create: {
        id: 'downtown',
        name: 'Downtown',
        cityId: chicago.id,
      },
    });

    // Seed Zones for Fort Wayne
    const northOTW = await prisma.zone.upsert({
      where: { id: 'north-otw' },
      update: { name: 'North OTW', cityId: fortWayne.id },
      create: {
        id: 'north-otw',
        name: 'North OTW',
        cityId: fortWayne.id,
      },
    });

    const southOTW = await prisma.zone.upsert({
      where: { id: 'south-otw' },
      update: { name: 'South OTW', cityId: fortWayne.id },
      create: {
        id: 'south-otw',
        name: 'South OTW',
        cityId: fortWayne.id,
      },
    });

    const eastOTW = await prisma.zone.upsert({
      where: { id: 'east-otw' },
      update: { name: 'East OTW', cityId: fortWayne.id },
      create: {
        id: 'east-otw',
        name: 'East OTW',
        cityId: fortWayne.id,
      },
    });

    const westOTW = await prisma.zone.upsert({
      where: { id: 'west-otw' },
      update: { name: 'West OTW', cityId: fortWayne.id },
      create: {
        id: 'west-otw',
        name: 'West OTW',
        cityId: fortWayne.id,
      },
    });

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
        stripeEnvKey: 'STRIPE_PRICE_BASIC',
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
        stripeEnvKey: 'STRIPE_PRICE_PLUS',
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
        stripeEnvKey: 'STRIPE_PRICE_PRO',
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
        stripeEnvKey: 'STRIPE_PRICE_ELITE',
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
        stripeEnvKey: 'STRIPE_PRICE_BLACK',
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
      const record = await prisma.membershipPlan.upsert({
        where: { name: plan.name },
        update: {
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
        },
        create: {
          name: plan.name,
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
        },
      });
      upsertedPlans.push(record.name);
    }

    console.warn(`[Seed] ✓ Upserted membership plans: ${upsertedPlans.join(', ')}`);

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        cities: [chicago.name, fortWayne.name],
        zones: [southSide.name, westSide.name, downtown.name, northOTW.name, southOTW.name, eastOTW.name, westOTW.name],
        plans: upsertedPlans,
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
