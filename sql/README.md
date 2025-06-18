# Database Migrations

This directory contains SQL migration files for The Duck application. These files should be executed in order to set up the complete database schema.

## Migration Files

### 1. `create_usage_tables.sql`
Creates the credit usage tracking system:
- `user_credits` - Stores user credit limits and usage
- `user_usage` - Tracks individual API usage records

### 2. `create_chat_summaries_table.sql` 
Creates the chat summaries table:
- `chat_summaries` - Stores AI-generated summaries of chat conversations
- Includes UNIQUE constraint on `session_id` for upsert operations
- Includes proper RLS policies

### 3. `migrate_learning_preferences.sql`
Migrates learning preferences to optimized JSON structure:
- `user_learning_preferences` - Stores user preferences in efficient JSON format
- Includes migration from old row-based structure

### 4. `verify_schema.sql`
Verification script to check database integrity:
- Verifies all required tables exist
- Checks for required constraints
- Validates RLS is enabled
- Lists all indexes

## How to Apply Migrations

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Execute each migration file in order:
   - First: `create_usage_tables.sql`
   - Second: `create_chat_summaries_table.sql`
   - Third: `migrate_learning_preferences.sql`
   - Finally: Run `verify_schema.sql` to verify everything is set up correctly

### Using Supabase CLI

```bash
# Apply migrations
supabase db push --db-url "postgresql://postgres:[password]@[host]:5432/postgres"

# Or if you have migrations set up
supabase migration up
```

## Important Notes

1. **Order Matters**: Apply migrations in the order listed above
2. **Check Foreign Keys**: The `chat_summaries` table references `chat_sessions`, so ensure `chat_sessions` table exists first
3. **RLS Policies**: All tables have Row Level Security enabled - ensure your application uses authenticated requests
4. **Verification**: Always run `verify_schema.sql` after applying migrations to ensure everything is set up correctly

## Troubleshooting

If you encounter errors:

1. **Foreign Key Constraint Errors**: Ensure referenced tables exist first
2. **Duplicate Key Errors**: Check if the table/constraint already exists
3. **Permission Errors**: Ensure you're using the correct database role
4. **RLS Errors**: Make sure you're authenticated when accessing the tables

## Schema Overview

```
chat_sessions (existing)
├── id (PK)
├── user_id (FK to auth.users)
├── title
├── messages
├── model
├── created_at
├── updated_at
└── is_active

chat_summaries (new)
├── id (PK)
├── session_id (FK to chat_sessions, UNIQUE)
├── summary
├── key_topics[]
├── user_preferences (JSONB)
├── writing_style_analysis (JSONB)
└── created_at

user_credits
├── user_id (PK, FK to auth.users)
├── credit_limit
├── credits_used
├── reset_period
├── last_reset
├── created_at
└── updated_at

user_usage
├── id (PK)
├── user_id (FK to auth.users)
├── session_id
├── model
├── prompt_tokens
├── completion_tokens
├── total_tokens
├── prompt_cost
├── completion_cost
├── total_cost
└── created_at

user_learning_preferences
├── user_id (PK, FK to auth.users)
├── preferences (JSONB)
├── created_at
└── updated_at
```