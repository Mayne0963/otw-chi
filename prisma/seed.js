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
  const chicago = await prisma.city.upsert({
    where: { name: 'Chicago' },
    update: {},
    create: { name: 'Chicago' },
  });

  const fortWayne = await prisma.city.upsert({
    where: { name: 'Fort Wayne' },
    update: {},
    create: { name: 'Fort Wayne' },
  });

  await prisma.zone.upsert({
    where: { id: 'south-side' },
    update: { name: 'South Side', cityId: chicago.id },
    create: { id: 'south-side', name: 'South Side', cityId: chicago.id },
  });

  await prisma.zone.upsert({
    where: { id: 'west-side' },
    update: { name: 'West Side', cityId: chicago.id },
    create: { id: 'west-side', name: 'West Side', cityId: chicago.id },
  });

  await prisma.zone.upsert({
    where: { id: 'downtown' },
    update: { name: 'Downtown', cityId: chicago.id },
    create: { id: 'downtown', name: 'Downtown', cityId: chicago.id },
  });

  await prisma.zone.upsert({
    where: { id: 'north-otw' },
    update: { name: 'North OTW', cityId: fortWayne.id },
    create: { id: 'north-otw', name: 'North OTW', cityId: fortWayne.id },
  });

  await prisma.zone.upsert({
    where: { id: 'south-otw' },
    update: { name: 'South OTW', cityId: fortWayne.id },
    create: { id: 'south-otw', name: 'South OTW', cityId: fortWayne.id },
  });

  await prisma.zone.upsert({
    where: { id: 'east-otw' },
    update: { name: 'East OTW', cityId: fortWayne.id },
    create: { id: 'east-otw', name: 'East OTW', cityId: fortWayne.id },
  });

  await prisma.zone.upsert({
    where: { id: 'west-otw' },
    update: { name: 'West OTW', cityId: fortWayne.id },
    create: { id: 'west-otw', name: 'West OTW', cityId: fortWayne.id },
  });

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

    await prisma.membershipPlan.upsert({
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
        allowedServiceTypes: plan.allowedServiceTypes ?? undefined,
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
        allowedServiceTypes: plan.allowedServiceTypes ?? undefined,
      },
    });
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
