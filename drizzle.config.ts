import type { Config } from 'drizzle-kit';

/**
 * 🗄️ Drizzle Database Configuration
 * 
 * Configuration for database migrations and schema generation
 */
export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/the_duck_chat',
  },
  verbose: process.env.DB_LOGGING === 'true',
  strict: true,
} satisfies Config;