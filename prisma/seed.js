import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const UNLIMITED_SERVICE_MILES = -1;

const DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL',
  'DIRECT_URL',
  'DATABASE_URL_NON_POOLING',
  'DATABASE_URL_UNPOOLED',
  'NEON_DATABASE_URL_NON_POOLING',
  'NEON_DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
];

function getDatabaseUrl() {
  for (const key of DATABASE_URL_KEYS) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  throw new Error(`Missing database connection string. Set one of: ${DATABASE_URL_KEYS.join(', ')}`);
}

const adapter = new PrismaNeon({ connectionString: getDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Helper to seed City safely
  const seedCity = async (name) => {
    try {
      const existing = await prisma.city.findUnique({
        where: { name }
      });
      
      if (existing) {
        console.log(`[Seed] City ${name} already exists (ID: ${existing.id})`);
        return existing;
      } else {
        const created = await prisma.city.create({
          data: { name }
        });
        console.log(`[Seed] Created City ${name} (ID: ${created.id})`);
        return created;
      }
    } catch (e) {
      console.error(`[Seed] Failed to seed city ${name}:`, e);
      throw e;
    }
  };

  const chicago = await seedCity('Chicago');
  const fortWayne = await seedCity('Fort Wayne');

  // Helper to seed Zone safely
  const seedZone = async (name, cityId, legacyId = null) => {
    // Try to find by name and city first
    let existing = await prisma.zone.findFirst({
      where: { name, cityId }
    });
    
    // If provided legacy ID, check if that exists too (in case name changed but ID persisted)
    if (!existing && legacyId) {
        try {
            existing = await prisma.zone.findUnique({ where: { id: legacyId } });
        } catch (e) {
            // Ignore if legacy ID format is invalid for current schema
        }
    }

    if (existing) {
      console.log(`[Seed] Zone ${name} already exists (ID: ${existing.id})`);
      return existing;
    } else {
      // Create WITHOUT forcing the ID, let CUID generate
      // We ignore legacyId for creation to respect the schema's @default(cuid())
      const created = await prisma.zone.create({
        data: { name, cityId }
      });
      console.log(`[Seed] Created Zone ${name} (ID: ${created.id})`);
      return created;
    }
  };

  await seedZone('South Side', chicago.id, 'south-side');
  await seedZone('West Side', chicago.id, 'west-side');
  await seedZone('Downtown', chicago.id, 'downtown');
  await seedZone('North OTW', fortWayne.id, 'north-otw');
  await seedZone('South OTW', fortWayne.id, 'south-otw');
  await seedZone('East OTW', fortWayne.id, 'east-otw');
  await seedZone('West OTW', fortWayne.id, 'west-otw');

  const plansToUpsert = [
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

  for (const plan of plansToUpsert) {
    const stripePriceId = plan.stripeEnvKey ? process.env[plan.stripeEnvKey] || null : null;
    if (plan.publicMonthlyPriceCents && plan.monthlyServiceMiles > 0) {
      const effectiveCents = plan.publicMonthlyPriceCents / plan.monthlyServiceMiles;
      if (effectiveCents < 110) {
        throw new Error(`Plan ${plan.name} violates Service Mile floor`);
      }
    }

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
      allowedServiceTypes: plan.allowedServiceTypes ?? undefined,
    };

    const existingPlan = await prisma.membershipPlan.findUnique({
        where: { name: plan.name }
    });

    if (existingPlan) {
        // Safe update: Prisma allows updating fields even if ID is CUID, as long as we don't touch ID
        await prisma.membershipPlan.update({
            where: { name: plan.name },
            data: planData
        });
        console.log(`[Seed] Updated Plan ${plan.name}`);
    } else {
        await prisma.membershipPlan.create({
            data: {
                name: plan.name,
                ...planData
            }
        });
        console.log(`[Seed] Created Plan ${plan.name}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
