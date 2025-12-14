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

  await Promise.all([
    prisma.zone.upsert({ where: { slug: 'south-side' }, update: {}, create: { name: 'South Side', slug: 'south-side', cityId: chi.id } }),
    prisma.zone.upsert({ where: { slug: 'west-side' }, update: {}, create: { name: 'West Side', slug: 'west-side', cityId: chi.id } }),
    prisma.zone.upsert({ where: { slug: 'downtown' }, update: {}, create: { name: 'Downtown', slug: 'downtown', cityId: chi.id } })
  ]);

  await Promise.all([
    prisma.membershipPlan.upsert({ where: { name: 'Broski Basic' }, update: {}, create: { name: 'Broski Basic', priceCents: 900, perks: { perks: ['Standard delivery rates', 'NIP Coin rewards', 'Email support'] } } }),
    prisma.membershipPlan.upsert({ where: { name: 'Broski+' }, update: {}, create: { name: 'Broski+', priceCents: 1900, perks: { perks: ['Lower delivery fees', 'Priority drivers', 'NIP Coin multiplier'] } } }),
    prisma.membershipPlan.upsert({ where: { name: 'Executive Broski' }, update: {}, create: { name: 'Executive Broski', priceCents: 3900, perks: { perks: ['Concierge scheduling', 'VIP queue', 'Free miles buffer', 'Tripled NIP Coin'] } } })
  ]);

  console.log('Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
