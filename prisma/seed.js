const { PrismaClient } = require('@prisma/client');
const { neonConfig, Pool } = require('@neondatabase/serverless');
const { PrismaNeon } = require('@prisma/adapter-neon');

neonConfig.fetchConnectionCache = true;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const chi = await prisma.city.upsert({
    where: { slug: 'chicago' },
    update: {},
    create: { name: 'Chicago', slug: 'chicago' }
  });
  const fwn = await prisma.city.upsert({
    where: { slug: 'fort-wayne' },
    update: {},
    create: { name: 'Fort Wayne', slug: 'fort-wayne' }
  });

  await Promise.all([
    prisma.zone.upsert({ where: { slug: 'south-side' }, update: {}, create: { name: 'South Side', slug: 'south-side', cityId: chi.id } }),
    prisma.zone.upsert({ where: { slug: 'west-side' }, update: {}, create: { name: 'West Side', slug: 'west-side', cityId: chi.id } }),
    prisma.zone.upsert({ where: { slug: 'downtown' }, update: {}, create: { name: 'Downtown', slug: 'downtown', cityId: chi.id } })
  ]);
  await Promise.all([
    prisma.zone.upsert({ where: { slug: 'north-otw' }, update: {}, create: { name: 'North OTW', slug: 'north-otw', cityId: fwn.id } }),
    prisma.zone.upsert({ where: { slug: 'south-otw' }, update: {}, create: { name: 'South OTW', slug: 'south-otw', cityId: fwn.id } }),
    prisma.zone.upsert({ where: { slug: 'east-otw' }, update: {}, create: { name: 'East OTW', slug: 'east-otw', cityId: fwn.id } }),
    prisma.zone.upsert({ where: { slug: 'west-otw' }, update: {}, create: { name: 'West OTW', slug: 'west-otw', cityId: fwn.id } })
  ]);

  await Promise.all([
    prisma.membershipPlan.upsert({ where: { name: 'Basic' }, update: {}, create: { name: 'Basic', priceCents: 900, code: 'BASIC', monthlyPrice: 900, milesCap: 2000, nipMultiplier: 1.0, perks: { perks: ['Standard delivery rates', 'NIP Coin rewards', 'Email support'] } } }),
    prisma.membershipPlan.upsert({ where: { name: 'Plus' }, update: {}, create: { name: 'Plus', priceCents: 1900, code: 'PLUS', monthlyPrice: 1900, milesCap: 4000, nipMultiplier: 1.5, perks: { perks: ['Lower delivery fees', 'Priority drivers', 'NIP Coin multiplier'] } } }),
    prisma.membershipPlan.upsert({ where: { name: 'Executive' }, update: {}, create: { name: 'Executive', priceCents: 3900, code: 'EXEC', monthlyPrice: 3900, milesCap: 8000, nipMultiplier: 3.0, perks: { perks: ['Concierge scheduling', 'VIP queue', 'Free miles buffer', 'Tripled NIP Coin'] } } })
  ]);

  console.log('Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
