import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  // Path to the Prisma schema file
  schema: 'prisma/schema.prisma',
  
  // Migration configuration
  migrations: {
    path: 'prisma/migrations',
  },
  
  // Database connection URL from environment
  datasource: {
    url: env('DATABASE_URL'),
  },
})
