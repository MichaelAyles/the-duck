# GEMINI.md

This file provides guidance to Gemini when working with code in this repository.

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

## Gemini Workflow

**MANDATORY**: After completing ANY development task, Gemini must ALWAYS follow this workflow:

### 1. **Test Coverage**
- I will ensure that any feature I am working on has test coverage.
- If there are no tests, I will add them.

### 2. **Quality Validation**
- After making any code modifications, I will run the quality validation workflow myself:
  ```bash
  npm run workflow
  ```
- I will wait for all checks to pass before proceeding.

### 3. **Inform User of Changes**
- After the validation workflow has passed, I will inform the user that the changes are complete and ready for their review.

### 4. **Documentation Updates**
- Update `todo.md` to mark completed tasks as ✅.
- Update `GEMINI.md` if new patterns/conventions were established.
- Update any relevant documentation files if APIs or architecture changed.

### 5. **Commit & Deploy**
**CRITICAL**: I will **NEVER** make a commit unless explicitly told to by the user.
- I will always ask for permission before running any `git` commands.
- If the user approves, I will stage the changes and propose a commit message for their review.

### 6. **Commit Message Generation Rules**
Generate commit messages using this format:
- **feat**: New features or major functionality
- **fix**: Bug fixes or corrections
- **refactor**: Code restructuring without functionality changes
- **docs**: Documentation updates
- **style**: Code formatting, lint fixes
- **chore**: Maintenance tasks, dependency updates

**CRITICAL**: I will **NEVER** include self-citations or references to Gemini in commit messages. This includes any mention of AI, Gemini, or automated generation.

**Example Messages:**
- `feat: Add file upload API with Supabase storage integration`
- `fix: Resolve state race conditions in message handling hooks`
- `refactor: Extract chat lifecycle management into useChatLifecycle hook`

### 7. **Verification**
After the user has approved a push to the repository, I will mention that:
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
'''typescript
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
'''

## Hook Development Patterns

When working with the modular hook architecture:

### **Creating New Hooks**
1. **Single Responsibility**: Each hook should handle one specific concern
2. **Proper Dependencies**: Use useCallback and useMemo to prevent unnecessary re-renders
3. **Error Handling**: Include comprehensive error handling with toast notifications
4. **Cleanup**: Always return cleanup functions from useEffect hooks
5. **Type Safety**: Use proper TypeScript interfaces and avoid `any` types

### **Hook Composition**
'''typescript
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
'''

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

## Development Best Practices
When working on this codebase:
1. Always check for existing cleanup functions when adding useEffect hooks
2. Use refs for stable callback dependencies to prevent re-renders
3. Extract hardcoded values to config.ts
4. Ensure proper error handling with user-friendly messages
5. Test authentication flows thoroughly when modifying API routes
