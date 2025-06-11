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
- **Database Operations** (`lib/db/server-operations.ts`): Server-side authenticated operations

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

Required environment variables (see `.env.local.example`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
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