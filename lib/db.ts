import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { getDatabaseUrlSource } from "./dbUrl";

type GlobalWithPrisma = typeof globalThis & {
  __OTW_PRISMA__?: PrismaClient
}

export function getPrisma(): PrismaClient {
  const g = globalThis as GlobalWithPrisma
  if (g.__OTW_PRISMA__) return g.__OTW_PRISMA__

  const { url: connectionString } = getDatabaseUrlSource();

  // Create Neon adapter for Prisma 7
  const adapter = new PrismaNeon({ connectionString })
  const client = new PrismaClient({ adapter })
  
  g.__OTW_PRISMA__ = client
  return client
}

// Export singleton instance
export const prisma = getPrisma()
export default prisma
