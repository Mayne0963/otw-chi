import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Seed] Starting database seed...');
    
    const prisma = getPrisma();
    
    // Seed Cities
    console.log('[Seed] Seeding cities...');
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

    console.log(`[Seed] ✓ Created cities: ${chicago.name}, ${fortWayne.name}`);

    // Seed Zones for Chicago
    console.log('[Seed] Seeding zones...');
    const southSide = await prisma.zone.upsert({
      where: { id: 'south-side' },
      update: {},
      create: {
        id: 'south-side',
        name: 'South Side',
        cityId: chicago.id,
      },
    });

    const westSide = await prisma.zone.upsert({
      where: { id: 'west-side' },
      update: {},
      create: {
        id: 'west-side',
        name: 'West Side',
        cityId: chicago.id,
      },
    });

    const downtown = await prisma.zone.upsert({
      where: { id: 'downtown' },
      update: {},
      create: {
        id: 'downtown',
        name: 'Downtown',
        cityId: chicago.id,
      },
    });

    // Seed Zones for Fort Wayne
    const northOTW = await prisma.zone.upsert({
      where: { id: 'north-otw' },
      update: {},
      create: {
        id: 'north-otw',
        name: 'North OTW',
        cityId: fortWayne.id,
      },
    });

    const southOTW = await prisma.zone.upsert({
      where: { id: 'south-otw' },
      update: {},
      create: {
        id: 'south-otw',
        name: 'South OTW',
        cityId: fortWayne.id,
      },
    });

    const eastOTW = await prisma.zone.upsert({
      where: { id: 'east-otw' },
      update: {},
      create: {
        id: 'east-otw',
        name: 'East OTW',
        cityId: fortWayne.id,
      },
    });

    const westOTW = await prisma.zone.upsert({
      where: { id: 'west-otw' },
      update: {},
      create: {
        id: 'west-otw',
        name: 'West OTW',
        cityId: fortWayne.id,
      },
    });

    console.log(`[Seed] ✓ Created zones: ${southSide.name}, ${westSide.name}, ${downtown.name}, ${northOTW.name}, ${southOTW.name}, ${eastOTW.name}, ${westOTW.name}`);

    // Seed Membership Plans
    console.log('[Seed] Seeding membership plans...');
    
    const basicPlan = await prisma.membershipPlan.upsert({
      where: { name: 'Basic' },
      update: {},
      create: {
        name: 'Basic',
        priceCents: 900,
        code: 'BASIC',
        monthlyPrice: 900,
        milesCap: 2000,
        nipMultiplier: 1.0,
        perks: {
          perks: ['Standard delivery rates', 'TIREM rewards', 'Email support']
        },
      },
    });

    const plusPlan = await prisma.membershipPlan.upsert({
      where: { name: 'Plus' },
      update: {},
      create: {
        name: 'Plus',
        priceCents: 1900,
        code: 'PLUS',
        monthlyPrice: 1900,
        milesCap: 4000,
        nipMultiplier: 1.5,
        perks: {
          perks: ['Lower delivery fees', 'Priority drivers', 'TIREM multiplier']
        },
      },
    });

    const executivePlan = await prisma.membershipPlan.upsert({
      where: { name: 'Executive' },
      update: {},
      create: {
        name: 'Executive',
        priceCents: 3900,
        code: 'EXEC',
        monthlyPrice: 3900,
        milesCap: 8000,
        nipMultiplier: 3.0,
        perks: {
          perks: ['Concierge scheduling', 'VIP queue', 'Free miles buffer', 'Tripled TIREM']
        },
      },
    });

    console.log(`[Seed] ✓ Created membership plans: ${basicPlan.name}, ${plusPlan.name}, ${executivePlan.name}`);

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        cities: [chicago.name, fortWayne.name],
        zones: [southSide.name, westSide.name, downtown.name, northOTW.name, southOTW.name, eastOTW.name, westOTW.name],
        plans: [basicPlan.name, plusPlan.name, executivePlan.name],
      },
    });
  } catch (error: any) {
    console.error('[Seed] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
