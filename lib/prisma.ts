import { PrismaClient } from '@/prisma/generated/prisma'
import { PrismaNeon } from '@prisma/adapter-neon'

type GlobalWithPrisma = typeof globalThis & {
  __PRISMA__?: PrismaClient
}

const globalForPrisma = globalThis as GlobalWithPrisma

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.__PRISMA__ ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.__PRISMA__ = prisma

export default prisma
