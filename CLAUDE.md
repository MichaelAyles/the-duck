# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

The Duck is a Next.js 15 chat application that provides a multi-model LLM interface similar to ChatGPT, with support for various AI models through OpenRouter. It uses Supabase for authentication and data persistence.

## Critical Security Issues

**🚨 P0 CRITICAL**: This codebase has severe security vulnerabilities that MUST be addressed:
1. Direct client-side database access in `supabase-operations.ts` exposes database credentials
2. Multiple insecure test/debug API routes are exposed in production
3. Database operations must be moved to server-side API routes with proper authentication

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Next.js API routes with App Router
- **Database**: Supabase (PostgreSQL with Row-Level Security)
- **Authentication**: Supabase Auth (Google/GitHub OAuth)
- **AI Integration**: OpenRouter API for multi-model LLM support
- **Real-time**: Server-Sent Events for streaming chat responses

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Run linting with auto-fix
npm run lint:fix

# Run type checking
npm run type-check

# Run complete workflow (build + lint + type-check)
npm run workflow

# Database setup (first time only)
node scripts/dev-setup.js
```

## Claude Code Automated Task Completion Workflow

**MANDATORY**: After completing ANY development task, Claude Code must ALWAYS execute this complete workflow:

### 1. **Quality Validation**
```bash
npm run build          # Ensure project builds successfully
npm run lint:fix       # Fix linting errors automatically
npm run type-check     # Verify TypeScript types are correct
```
- **CRITICAL**: If ANY step fails, fix ALL issues before proceeding
- **MANDATORY**: All lint errors must be resolved before committing
- **NO EXCEPTIONS**: Do not commit broken code or code with lint errors
- Re-run validation commands until all pass with zero errors

### 2. **Documentation Updates**
- Update `todo.md` to mark completed tasks as ✅
- Update `CLAUDE.md` if new patterns/conventions were established
- Update any relevant documentation files if APIs or architecture changed

### 3. **Commit & Deploy**
```bash
git add -A                           # Stage all changes
git commit -m "[generated message]"  # Commit with descriptive message
git push origin main                 # Push to main branch for Vercel deployment
```

### 4. **Commit Message Generation Rules**
Generate commit messages using this format:
- **feat**: New features or major functionality
- **fix**: Bug fixes or corrections
- **refactor**: Code restructuring without functionality changes
- **docs**: Documentation updates
- **style**: Code formatting, lint fixes
- **chore**: Maintenance tasks, dependency updates

**CRITICAL**: Never include self-citations or references to Claude Code in commit messages.

**Example Messages:**
- `feat: Add file upload API with Supabase storage integration`
- `fix: Resolve authentication timeout issues in chat sessions`
- `refactor: Extract chat message handling into custom hooks`
- `docs: Update API documentation for new user preferences endpoints`

### 5. **Verification**
After pushing, mention to the user that:
- ✅ Build validation passed
- ✅ Code pushed to main branch
- ✅ Vercel deployment will update automatically
- ✅ Documentation updated

**This workflow is MANDATORY for every task completion - no exceptions.**

## Architecture

### Directory Structure
- `/src/app/` - Next.js App Router pages and API routes
- `/src/components/` - React components (auth, chat, UI)
- `/src/lib/` - Core utilities and services
- `/src/hooks/` - Custom React hooks
- `/src/types/` - TypeScript type definitions
- `/sql/` - Database schema and migrations
- `/docs/` - Technical documentation

### Key Services
- **Auth Service** (`lib/auth.ts`): Manages Supabase authentication
- **Chat Service** (`lib/chat-service.ts`): Handles chat operations and streaming
- **Database Operations** (`lib/db/`): Database interaction layer (needs refactoring)
- **OpenRouter** (`lib/openrouter.ts`): LLM model management and API integration

### Authentication Flow
1. User signs in via Supabase Auth (Google/GitHub OAuth)
2. Session stored in cookies via middleware
3. AuthProvider provides session context throughout app
4. API routes verify authentication before database operations

### Chat Architecture
1. User selects AI model from OpenRouter's catalog
2. Messages sent to `/api/chat` endpoint
3. Server streams responses using Server-Sent Events
4. Chat history saved to Supabase with user association
5. Summaries generated for long conversations

### Database Schema
- **chat_sessions**: Stores conversations with messages array
- **chat_summaries**: AI-generated summaries linked to sessions
- **user_preferences**: User settings (starred models, theme, etc.)
- All tables use Row-Level Security (RLS) for data isolation

## Security Refactoring Requirements

When working on security improvements:
1. Move all database operations from `supabase-operations.ts` to server-side API routes
2. Remove or secure all test/debug endpoints before production
3. Ensure all API routes check authentication before database access
4. Use server-side Supabase client (`lib/supabase/server.ts`) for database operations
5. Never expose Supabase service role key to client

## Environment Variables

Required environment variables (see `.env.local.example`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)
- `OPENROUTER_API_KEY` - OpenRouter API key for LLM access

## Testing

Currently no automated tests. When implementing:
- Use the existing test API routes as examples
- Focus on security-critical paths first
- Test authentication flows and RLS policies

## Performance Optimizations

- Streaming responses reduce time-to-first-byte
- Chat summaries reduce payload size for long conversations
- Debounced model search prevents excessive API calls
- Optimistic UI updates for better perceived performance

## Common Tasks

### Adding a New API Route
1. Create route file in `/src/app/api/[route-name]/route.ts`
2. Use `createClient` from `lib/supabase/server.ts` for auth
3. Verify user authentication before any operations
4. Return appropriate error responses for unauthorized access

### Modifying Database Schema
1. Update SQL files in `/sql/` directory
2. Run migrations through Supabase dashboard
3. Update TypeScript types in `/src/types/supabase.ts`
4. Ensure RLS policies are properly configured

### Working with Chat Features
- Chat state managed by `use-chat.ts` hook
- Streaming handled by `chat-service.ts`
- UI components in `/src/components/chat/`
- Always preserve chat history when making changes