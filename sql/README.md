# Database Setup & Schema

This directory contains the complete database schema for The Duck application. The schema has been consolidated into a single, comprehensive setup file for easier deployment and maintenance.

## Quick Start

### Single Setup File

The entire database schema is contained in **`complete-database-setup.sql`** - this is the only file you need to run.

**To set up the database:**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `complete-database-setup.sql`
4. Execute the script

That's it! The script will:
- ✅ Create all required tables and indexes
- ✅ Set up Row Level Security (RLS) policies
- ✅ Configure the file upload system
- ✅ Migrate any existing data
- ✅ Verify the setup is complete

## What's Included

### 🗄️ **Core Tables**
- **`chat_sessions`** - Chat conversation storage
- **`chat_summaries`** - AI-generated conversation summaries
- **`user_preferences`** - User settings and preferences
- **`user_credits`** - Credit usage tracking (billing system)
- **`user_usage`** - Detailed API usage logs
- **`user_learning_preferences_v2`** - AI personalization preferences (optimized JSON structure)

### 📁 **File Upload System**
- **`file_uploads`** - File metadata and associations
- **`storage.buckets`** - Supabase storage bucket configuration
- **Storage policies** - Secure file access controls

### ⚡ **Performance Features**
- **15+ optimized indexes** for fast queries
- **GIN indexes** for JSON search capabilities
- **Composite indexes** for complex queries
- **Partial indexes** for active records

### 🔒 **Security Features**
- **Row Level Security (RLS)** on all user tables
- **User-specific access policies** prevent data leaks
- **Authenticated access only** for all operations
- **Storage bucket security** for file uploads

## Database Schema Overview

```
Core User Data:
├── auth.users (Supabase managed)
├── user_preferences
│   ├── starred_models (TEXT[])
│   ├── theme (TEXT)
│   ├── default_model (TEXT)
│   └── storage_enabled (BOOLEAN)
└── user_learning_preferences_v2
    └── preferences (JSONB) - Optimized structure

Chat System:
├── chat_sessions
│   ├── id (TEXT PK)
│   ├── user_id (UUID FK)
│   ├── title (TEXT)
│   ├── messages (JSONB[])
│   ├── model (TEXT)
│   └── metadata (JSONB)
└── chat_summaries
    ├── session_id (TEXT FK, UNIQUE)
    ├── summary (TEXT)
    ├── key_topics (TEXT[])
    └── analysis (JSONB)

File Upload System:
└── file_uploads
    ├── id (UUID PK)
    ├── user_id (UUID FK)
    ├── session_id (TEXT FK, nullable)
    ├── message_id (TEXT, nullable)
    ├── file_name (TEXT)
    ├── storage_path (TEXT)
    ├── mime_type (TEXT)
    └── constraints (10MB limit, approved MIME types)

Billing & Usage:
├── user_credits
│   ├── user_id (UUID PK)
│   ├── total_credits (INTEGER) - Amount in pence
│   ├── used_credits (INTEGER) - Amount in pence
│   ├── credit_limit_period (TEXT)
│   └── last_reset_at (TIMESTAMP)
└── user_usage
    ├── user_id (UUID FK)
    ├── endpoint (TEXT)
    ├── model (TEXT)
    ├── token_count (INTEGER)
    └── metadata (JSONB) - Cost, timing, etc.
```

## Key Features

### 🎯 **Smart Setup**
- **Idempotent operations** - Safe to run multiple times
- **Automatic migrations** - Converts old data structures
- **Data preservation** - Never loses existing data
- **Cleanup routines** - Removes duplicates and fixes inconsistencies

### 💳 **Beta Billing System**
- **£1.00 monthly limit** for all users during beta
- **Pence-based calculations** prevent floating-point errors
- **Automatic reset** on monthly boundaries
- **Detailed usage tracking** by model and endpoint

### 📄 **File Upload Ready**
- **10MB file size limit** per upload
- **Comprehensive MIME type support** (images, documents, code, archives)
- **Secure storage bucket** with proper access controls
- **Message-level file associations** for chat context

### 🔍 **Advanced Search**
- **GIN indexes** for JSONB search capabilities
- **Full-text search ready** for learning preferences
- **Optimized queries** for large datasets
- **Performance monitoring** built-in

## Verification

The setup script includes comprehensive verification that checks:

- ✅ All required tables exist
- ✅ Foreign key relationships are correct
- ✅ RLS policies are active
- ✅ Performance indexes are created
- ✅ Storage bucket is configured
- ✅ File upload constraints are in place

## Troubleshooting

### Common Issues

**❌ Permission denied for table/function**
- Ensure you're running the script as a database admin
- Check that you're using the correct Supabase project

**❌ Storage bucket already exists**
- This is normal - the script handles existing buckets safely
- The script will update bucket configuration if needed

**❌ Foreign key constraint errors**
- The script creates tables in the correct order
- If you see this error, ensure you're running the complete script

### Getting Help

If you encounter issues:

1. **Check the verification output** at the end of the script
2. **Review the table status** section for missing components  
3. **Verify RLS policies** are showing the expected count
4. **Check performance indexes** are created properly

## Production Notes

### Security
- 🔒 All user data is protected by Row Level Security
- 🔑 Authentication required for all operations
- 🚫 No direct database access from client code
- 🛡️ Server-side API validation for all requests

### Performance
- ⚡ Optimized for real-time chat operations
- 📊 Efficient JSON storage for learning preferences
- 🔍 Fast search capabilities across all data types
- 📈 Scales with user growth patterns

### Maintenance
- 🧹 Automatic cleanup of duplicate data
- 🔄 Safe schema migrations preserve all data
- 📝 Comprehensive logging for debugging
- 🔧 Built-in health checks and verification