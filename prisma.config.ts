import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

const DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL',
] as const

const pickDatabaseUrlKey = () => {
  for (const key of DATABASE_URL_KEYS) {
    if (process.env[key]) return key
  }
  return 'DATABASE_URL'
}

export default defineConfig({
  // Path to the Prisma schema file
  schema: 'prisma/schema.prisma',
  
  // Migration configuration
  migrations: {
    path: 'prisma/migrations',
  },
  
  // Database connection URL from environment
  datasource: {
    url: env(pickDatabaseUrlKey()),
  },
})
