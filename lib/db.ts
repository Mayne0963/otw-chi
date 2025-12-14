import { PrismaClient } from '@prisma/client';

export function getPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing DATABASE_URL');
  }
  // Dynamic requires to avoid TS type mismatch in adapters
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PrismaNeonAny: any = require('@prisma/adapter-neon').PrismaNeon;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const neonAny: any = require('@neondatabase/serverless').neon;
  const adapter = new PrismaNeonAny(neonAny(url));
  return new PrismaClient({ adapter } as any);
}
