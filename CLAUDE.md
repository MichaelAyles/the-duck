# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

The Duck is a modern, secure Next.js 15 chat application that provides a multi-model LLM interface with a modular hook-based architecture. It uses Supabase for authentication and data persistence, with a secure server-side API architecture.

## ✅ Architecture Status

**🔐 SECURE**: All critical security vulnerabilities have been eliminated:
- ✅ Server-side API architecture with proper authentication boundaries
- ✅ Zero client-side database access
- ✅ All debug/test routes removed from production
- ✅ Comprehensive input validation and error handling

## 🏗️ Current Architecture

### **Modular Hook-Based Design**
The application uses a clean separation of concerns with focused React hooks:

- **`useChatSession`**: Session management, message loading, welcome messages
- **`useMessageHandling`**: Message sending, streaming, error handling with toast notifications
- **`useChatSettings`**: Configuration, model preferences, settings changes
- **`useChatLifecycle`**: Chat ending, inactivity handling, cleanup operations

### **Centralized Configuration**
All constants and configuration managed in `/src/lib/config.ts`:
- API endpoints and timeouts
- Default models and settings  
- Welcome messages and UI text
- Performance thresholds

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Next.js API routes with App Router
- **Database**: Supabase (PostgreSQL with Row-Level Security)
- **Caching & Rate Limiting**: Upstash Redis (serverless Redis)
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
**IMPORTANT**: Always ask the user for permission before committing changes. Wait for explicit approval before proceeding with git commands.

Once approved by the user:
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

**CRITICAL**: Never include self-citations or references to Claude Code in commit messages. Do not include:
- 🤖 Generated with [Claude Code](https://claude.ai/code)
- Co-Authored-By: Claude <noreply@anthropic.com>
- Any mention of AI, Claude, or automated generation

**Example Messages:**
- `feat: Add file upload API with Supabase storage integration`
- `fix: Resolve state race conditions in message handling hooks`
- `refactor: Extract chat lifecycle management into useChatLifecycle hook`
- `docs: Update architecture documentation for hook-based design`
- `style: Fix remaining lint errors and optimize React re-renders`

### 5. **Verification**
After pushing, mention to the user that:
- ✅ Build validation passed
- ✅ Code pushed to main branch
- ✅ Vercel deployment will update automatically
- ✅ Documentation updated

**This workflow is MANDATORY for every task completion - no exceptions.**

## Architecture

### Directory Structure
- `/src/app/` - Next.js App Router pages and secure API routes
- `/src/components/` - React components with hook-based architecture
- `/src/hooks/` - Custom React hooks for modular functionality
- `/src/lib/` - Core utilities, services, and centralized configuration
- `/src/types/` - TypeScript type definitions
- `/sql/` - Database schema and migrations
- `/docs/` - Technical documentation

### Key Services & Hooks
- **Chat Hooks**: Modular hook-based architecture for clean separation of concerns
  - `useChatSession`: Session management and message loading
  - `useMessageHandling`: Message processing and streaming
  - `useChatSettings`: Configuration and user preferences
  - `useChatLifecycle`: Chat ending and cleanup operations
- **Auth Service** (`lib/auth.ts`): Manages Supabase authentication
- **Chat Service** (`lib/chat-service.ts`): Business logic for chat operations
- **Configuration** (`lib/config.ts`): Centralized constants and defaults
- **Database Operations** (`lib/db/server-operations.ts`): Server-side authenticated operations with Redis caching
- **Redis Service** (`lib/redis.ts`): Distributed rate limiting and caching layer
- **Security Service** (`lib/security.ts`): Rate limiting, input validation, and security middleware

### Authentication Flow
1. User signs in via Supabase Auth (Google/GitHub OAuth)
2. Session stored in secure cookies via middleware
3. AuthProvider provides session context throughout app
4. All API routes verify authentication before any operations
5. Row-Level Security (RLS) provides additional database-level protection

### Chat Architecture
1. User selects AI model from OpenRouter's catalog via `useChatSettings`
2. Messages processed through `useMessageHandling` hook
3. Secure `/api/chat` endpoint handles streaming with authentication
4. `useChatSession` manages chat history and persistence
5. `useChatLifecycle` handles cleanup and summaries

### Database Schema
- **chat_sessions**: Stores conversations with messages array
- **chat_summaries**: AI-generated summaries linked to sessions
- **user_preferences**: User settings (starred models, theme, preferences)
- All tables use Row-Level Security (RLS) for data isolation
- All access goes through authenticated server-side API routes

### Redis Architecture
The application uses Upstash Redis for distributed caching and rate limiting:

#### **Caching Strategy**
- **User Preferences**: 30-minute TTL, invalidated on updates
- **Model Catalog**: 1-hour TTL for expensive OpenRouter API calls
- **Session Data**: 10-minute TTL for active chat sessions
- **Cache Keys**: Namespaced pattern (e.g., `user:{id}:preferences`, `models:catalog`)

#### **Rate Limiting**
- **Distributed Rate Limiting**: Works across all serverless instances
- **Sliding Window Algorithm**: Smooth rate limit distribution
- **Per-Endpoint Limits**: Different limits for chat, models, and general API calls
- **Graceful Degradation**: Falls back to allowing requests if Redis is unavailable

#### **Implementation Details**
```typescript
// Rate limiting example
const rateLimiter = createRateLimiter({
  requests: 100,
  window: '15m',
  prefix: 'rl:/api/chat'
});

// Caching example
const cached = await cache.get(cacheKeys.userPreferences(userId));
if (!cached) {
  const data = await fetchFromDatabase();
  await cache.set(cacheKey, data, CACHE_TTL.USER_PREFERENCES);
}
```

## Hook Development Patterns

When working with the modular hook architecture:

### **Creating New Hooks**
1. **Single Responsibility**: Each hook should handle one specific concern
2. **Proper Dependencies**: Use useCallback and useMemo to prevent unnecessary re-renders
3. **Error Handling**: Include comprehensive error handling with toast notifications
4. **Cleanup**: Always return cleanup functions from useEffect hooks
5. **Type Safety**: Use proper TypeScript interfaces and avoid `any` types

### **Hook Composition**
```typescript
// Example: Composing hooks in a component
export const ChatInterface = () => {
  const { user } = useAuth();
  
  const { sessionId, messages, setMessages, chatServiceRef, createNewSession } = useChatSession({
    initialSessionId,
    initialMessages,
    userId: user?.id,
    onSessionUpdate,
  });

  const { settings, handleSettingsChange } = useChatSettings();
  
  const { handleEndChat } = useChatLifecycle({
    messages,
    setMessages,
    settings,
    chatServiceRef,
    userId: user?.id,
    createNewSession,
  });

  const { isLoading, handleSendMessage } = useMessageHandling({
    sessionId,
    messages,
    setMessages,
    settings,
    chatServiceRef,
    userId: user?.id,
  });
  
  // Component JSX using hook values
};
```

### **Performance Considerations**
- Use React.memo for expensive components
- Implement proper dependency arrays in useCallback/useMemo
- Avoid object recreation in render cycles
- Use proper cleanup in useEffect hooks

## Environment Variables

Required environment variables (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `OPENROUTER_API_KEY` - OpenRouter API key for LLM access
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL for caching and rate limiting
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis authentication token

## Testing

Currently no automated tests. When implementing:
- Use the existing test API routes as examples
- Focus on security-critical paths first
- Test authentication flows and RLS policies

## Performance Optimizations

- **Redis Caching**: User preferences and model catalog cached for fast access
- **Distributed Rate Limiting**: Redis-based rate limiting works across all instances
- **Streaming Responses**: Reduce time-to-first-byte with SSE
- **Chat Summaries**: Reduce payload size for long conversations
- **Debounced Search**: Prevents excessive API calls during model search
- **Optimistic UI Updates**: Better perceived performance
- **Cache-Aside Pattern**: Strategic caching with automatic invalidation

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

## Architecture Review Findings (December 2024)

### **Overall Assessment**
The Duck demonstrates a modern, security-focused architecture with strong foundations. The modular hook-based design and server-side API architecture are well-executed. With recent performance optimizations eliminating all major bottlenecks, the project now earns an overall score of **8.5/10**.

### **Architectural Strengths**
1. **Security-First Design (9/10)**: Excellent boundary enforcement with zero client-side database access
2. **Type Safety (9/10)**: Comprehensive TypeScript usage throughout the codebase
3. **Error Handling (8/10)**: User-friendly toast notifications with graceful degradation
4. **Modular Architecture (8/10)**: Clean separation of concerns with focused hooks
5. **Performance Optimization (9/10)**: Recent optimizations eliminated all major bottlenecks

### **Critical Issues Identified**

#### **High Priority**
1. ~~**Race Conditions**: Multiple state updates without proper synchronization in `useMessageHandling`~~ ✅ **FIXED**: Implemented proper state sequencing and retry logic
2. ~~**Memory Leaks**: Missing cleanup functions in several useEffect hooks~~ ✅ **FIXED**: Added comprehensive cleanup functions
3. ~~**Scalability Issues**: In-memory rate limiter won't work in serverless environments~~ ✅ **FIXED**: Implemented Redis-based rate limiting
4. ~~**API Performance**: Models loading excessively and learning preferences inefficient schema~~ ✅ **FIXED**: Optimized to single queries
5. **Data Loss Risk**: Chat continues even when session saving fails

#### **Medium Priority**
1. **State Management**: Distributed state across hooks creates synchronization challenges
2. **Magic Numbers**: Hardcoded timeouts and values throughout the codebase
3. **Component Complexity**: ChatInterface has three rendering modes that should be separated
4. **No Test Coverage**: Critical for production readiness

### **Recommended Solutions**

#### **Immediate Actions**
1. ~~**Fix Race Conditions**: Implement proper state update sequencing in message handling~~ ✅ **COMPLETED**
2. ~~**Add Cleanup Functions**: Ensure all useEffect hooks properly clean up timers and subscriptions~~ ✅ **COMPLETED**
3. ~~**Implement Redis Rate Limiting**: Replace in-memory solution for production scalability~~ ✅ **COMPLETED**
4. ~~**Optimize API Performance**: Fix excessive models calls and learning preferences schema~~ ✅ **COMPLETED**
5. **Handle Save Failures**: Stop chat operations if session saving fails

#### **Architecture Improvements**
1. **Centralized State Management**: Consider Zustand or Jotai for complex state synchronization
2. **Extract Constants**: Move all magic numbers to centralized config
3. **Component Refactoring**: Split ChatInterface into separate auth/unauth components
4. **Add Test Suite**: Implement unit, integration, and E2E tests

### **Performance Considerations**
- ✅ **API Optimization**: Fixed excessive models calls (8+ to 1 per session)
- ✅ **Database Efficiency**: Learning preferences optimized from 1000+ rows to 1 JSON per user
- ✅ **Race Condition Prevention**: Added retry logic and loading state management
- ✅ **Memory Management**: Proper cleanup functions prevent memory leaks
- **Remaining Opportunities**: Virtualization for long message lists, pagination for chat history, optimistic UI updates

### **Security Validation**
All security claims have been verified:
- ✅ No client-side database access
- ✅ Proper authentication checks in all API routes
- ✅ Comprehensive input validation with Zod schemas
- ✅ Security headers and CORS properly configured

### **Development Best Practices**
When working on this codebase:
1. Always check for existing cleanup functions when adding useEffect hooks
2. Use refs for stable callback dependencies to prevent re-renders
3. Extract hardcoded values to config.ts
4. Ensure proper error handling with user-friendly messages
5. Test authentication flows thoroughly when modifying API routes