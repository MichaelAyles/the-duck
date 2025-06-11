# The Duck API Documentation 🦆

## Overview

The Duck is a modern, secure AI chat application built with Next.js 15, featuring a modular hook-based architecture, authenticated streaming conversations, and comprehensive user management. This document provides API documentation for the secure server-side architecture.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Hooks   │    │   API Routes    │    │   External APIs │
│   (Client)      │◄──►│   (Secure)      │◄──►│   (OpenRouter)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         └─────────────►│   Supabase DB   │◄─────────────┘
                        │   + Auth + RLS  │
                        └─────────────────┘
```

## Security Model

**🔐 All API routes require authentication**
- Server-side Supabase client with proper auth verification
- Row-Level Security (RLS) for database-level access control
- No client-side database access
- Comprehensive input validation with error handling

## API Endpoints

### 1. Chat Endpoint
**POST** `/api/chat`

Authenticated streaming chat endpoint with AI models.

#### Authentication
- Requires valid Supabase session cookie
- Returns 401 if not authenticated

#### Request Body
```typescript
{
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  model: string                    // OpenRouter model ID
  stream?: boolean                 // Enable streaming (default: true)
  tone?: string                   // Response tone preference
}
```

#### Response (Streaming)
```typescript
// Server-Sent Events format
data: {"content": "Hello there!"}
data: {"content": " How can I help you?"}
data: [DONE]
```

#### Error Responses
```typescript
{
  error: string
  details?: string               // Only in development
}
```

### 2. Session Management
**GET/POST/PUT/DELETE** `/api/sessions`
**GET/PUT/DELETE** `/api/sessions/[sessionId]`

Authenticated CRUD operations for chat sessions.

#### GET `/api/sessions`
List all user's chat sessions.

**Response:**
```typescript
{
  sessions: Array<{
    id: string
    title: string
    created_at: string
    updated_at: string
    message_count: number
  }>
}
```

#### POST `/api/sessions`
Create a new chat session.

**Request Body:**
```typescript
{
  title?: string
  messages?: Message[]
}
```

#### GET `/api/sessions/[sessionId]`
Get specific session with messages.

**Response:**
```typescript
{
  id: string
  title: string
  messages: Message[]
  created_at: string
  updated_at: string
}
```

#### PUT `/api/sessions/[sessionId]`
Update session title or messages.

**Request Body:**
```typescript
{
  title?: string
  messages?: Message[]
}
```

#### DELETE `/api/sessions/[sessionId]`
Delete a chat session.

**Response:** `204 No Content`

### 3. User Preferences
**GET/PUT/POST** `/api/user/preferences`

Manage user settings and model preferences.

#### GET `/api/user/preferences`
Get user's current preferences.

**Response:**
```typescript
{
  starredModels: string[]
  primaryModel: string
  theme: 'light' | 'dark' | 'system'
  responseTone: 'friendly' | 'professional' | 'casual' | 'academic' | 'match'
  storageEnabled: boolean
  explicitPreferences: Record<string, any>
  writingStyle: {
    verbosity: 'brief' | 'medium' | 'detailed'
    formality: 'casual' | 'neutral' | 'formal'
    technicalLevel: 'beginner' | 'intermediate' | 'advanced'
    preferredTopics: string[]
    dislikedTopics: string[]
  }
}
```

#### PUT `/api/user/preferences`
Update user preferences.

**Request Body:** Partial preferences object

#### POST `/api/user/preferences`
Special actions (toggle starred, set primary model).

**Request Body:**
```typescript
{
  action: 'toggleStarred' | 'setPrimary'
  modelId: string
}
```

### 4. Models
**GET** `/api/models`

Get available AI models from OpenRouter.

#### Query Parameters
- `search?: string` - Search model names/descriptions
- `limit?: number` - Limit results (default: 50)

#### Response
```typescript
{
  models: Array<{
    id: string
    name: string
    description: string
    pricing: {
      prompt: string
      completion: string
    }
    context_length: number
    architecture: {
      modality: string
      tokenizer: string
    }
  }>
  total: number
}
```

### 5. Model Search
**GET** `/api/search-models`

Search models with filtering and ranking.

#### Query Parameters
- `q: string` - Search query (required)
- `limit?: number` - Results limit

#### Response
```typescript
{
  results: Array<{
    id: string
    name: string
    description: string
    relevanceScore: number
  }>
  query: string
}
```

### 6. Starred Models
**GET** `/api/starred-models`

Get user's starred models with details.

#### Response
```typescript
{
  starredModels: Array<{
    id: string
    name: string
    description: string
    isPrimary: boolean
  }>
}
```

### 7. Title Generation
**POST** `/api/generate-title`

Generate title for chat session.

#### Request Body
```typescript
{
  messages: Message[]
  sessionId: string
}
```

#### Response
```typescript
{
  title: string
  sessionId: string
}
```

### 8. Chat History
**GET** `/api/chat-history`

Get paginated chat history for user.

#### Query Parameters
- `page?: number` - Page number (default: 1)
- `limit?: number` - Results per page (default: 20)

#### Response
```typescript
{
  sessions: Array<{
    id: string
    title: string
    lastMessage: string
    messageCount: number
    createdAt: string
    updatedAt: string
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

### 9. Summarization
**POST** `/api/summarize`

Generate chat summary (authenticated).

#### Request Body
```typescript
{
  messages: Message[]
  sessionId: string
}
```

#### Response
```typescript
{
  summary: string
  sessionId: string
}
```

## Hook Architecture

### Core Chat Hooks

#### `useChatSession`
Manages session lifecycle and message loading.

```typescript
const {
  sessionId,
  messages,
  setMessages,
  chatServiceRef,
  loadSessionMessages,
  createNewSession
} = useChatSession({
  initialSessionId,
  initialMessages,
  userId,
  onSessionUpdate
});
```

#### `useMessageHandling`
Handles message sending and streaming.

```typescript
const {
  isLoading,
  handleSendMessage,
  generateTitleIfNeeded
} = useMessageHandling({
  sessionId,
  messages,
  setMessages,
  settings,
  chatServiceRef,
  userId,
  onSessionUpdate
});
```

#### `useChatSettings`
Manages user configuration and preferences.

```typescript
const {
  settings,
  isProcessingStorage,
  setIsProcessingStorage,
  handleSettingsChange
} = useChatSettings();
```

#### `useChatLifecycle`
Handles chat ending and cleanup.

```typescript
const {
  handleEndChat,
  setupInactivityHandler
} = useChatLifecycle({
  messages,
  setMessages,
  settings,
  chatServiceRef,
  userId,
  createNewSession,
  setIsProcessingStorage,
  onSessionUpdate
});
```

## Database Schema

### Tables with RLS

#### chat_sessions
```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policy
CREATE POLICY "Users can only access their own sessions"
  ON chat_sessions FOR ALL
  USING (auth.uid() = user_id);
```

#### chat_summaries
```sql
CREATE TABLE chat_summaries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policy
CREATE POLICY "Users can only access their own summaries"
  ON chat_summaries FOR ALL
  USING (auth.uid() = user_id);
```

#### user_preferences
```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policy
CREATE POLICY "Users can only access their own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id);
```

## Authentication & Security

### Authentication Flow
1. User signs in via Supabase Auth (Google/GitHub)
2. Session cookie set with secure httpOnly flags
3. All API routes verify authentication via server-side Supabase client
4. RLS policies provide additional database-level security

### Security Features
- ✅ Server-side API routes with authentication
- ✅ Row-Level Security (RLS) on all tables
- ✅ Input validation with comprehensive error handling
- ✅ No client-side database access
- ✅ Secure session management
- ✅ Environment variable protection

## Configuration

### Environment Variables
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Application
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Centralized Config (`/src/lib/config.ts`)
```typescript
export const DEFAULT_AI_MODEL = "google/gemini-2.5-flash-preview-05-20";

export const CHAT_CONFIG = {
  TITLE_GENERATION_MESSAGE_LIMIT: 6,
  TITLE_GENERATION_TRIGGER_COUNT: 2,
  WELCOME_MESSAGE: "🦆 Hello! I'm The Duck...",
  INACTIVITY_TIMEOUT_MINUTES: 30,
};

export const API_ENDPOINTS = {
  CHAT: "/api/chat",
  GENERATE_TITLE: "/api/generate-title",
  USER_PREFERENCES: "/api/user/preferences",
  SESSIONS: "/api/sessions",
};
```

## Error Handling

### Standard Error Format
```typescript
{
  error: string           // Human-readable message
  details?: string        // Technical details (dev only)
  timestamp: string       // ISO timestamp
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (authenticated but no access)
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

## Development & Testing

### Quality Checks
```bash
npm run workflow      # Complete validation pipeline
npm run build         # Production build test
npm run lint          # Code quality check
npm run type-check    # TypeScript validation
```

### Environment Validation
```bash
npm run setup         # Interactive setup
npm run check-env     # Validate configuration
```

## Performance Considerations

### Caching Strategy
- Models list cached for 1 hour
- User preferences cached in React state
- Session data fetched on demand

### Optimization Features
- Server-Sent Events for efficient streaming
- React hooks with proper memoization
- Centralized configuration reduces bundle size
- Toast notifications for user feedback

### Database Performance
- Proper indexing on foreign keys
- JSONB for flexible message storage
- RLS policies optimized for performance
- Connection pooling via Supabase

## Monitoring & Debugging

### Error Tracking
- Comprehensive error boundaries
- Toast notifications for user errors
- Console logging for development
- Structured error responses

### Health Checks
All API routes include basic health validation and return appropriate error codes for monitoring.

---

## Migration Notes

This API documentation reflects the secure, production-ready architecture after the P1 refactor. Key changes from previous versions:

- ✅ All endpoints now require authentication
- ✅ Server-side API routes replace client-side database access
- ✅ Hook-based architecture for better maintainability
- ✅ Centralized configuration management
- ✅ Comprehensive error handling with user feedback

For development guidance, see `CLAUDE.md` for hook patterns and development workflows.