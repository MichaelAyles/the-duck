import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 🗄️ Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/aura_chat';

const client = postgres(connectionString, { 
  prepare: false,
  // Enable logging in development with DB_LOGGING=true
  debug: process.env.DB_LOGGING === 'true' && process.env.NODE_ENV === 'development',
});

export const db = drizzle(client, { 
  schema,
  // Enhanced logging for development
  logger: process.env.DB_LOGGING === 'true' && process.env.NODE_ENV === 'development',
});

export * from './schema';