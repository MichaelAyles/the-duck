# The Duck API Documentation 🦆

## Overview

The Duck is a modern AI chat application built with Next.js 15, featuring streaming conversations, chat persistence, and intelligent summarization. This document provides comprehensive API documentation for developers.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Routes    │    │   External APIs │
│   (React 19)    │◄──►│   (Next.js)     │◄──►│   (OpenRouter)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         └─────────────►│   Supabase DB   │◄─────────────┘
                        │   (PostgreSQL)  │
                        └─────────────────┘
```

## API Endpoints

### 1. Chat Endpoint
**POST** `/api/chat`

Main endpoint for AI conversations with streaming support.

#### Request Body
```typescript
{
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  model: string                    // OpenRouter model ID
  sessionId?: string              // Chat session ID (optional)
  stream?: boolean                // Enable streaming (default: true)
  temperature?: number            // 0.0 - 2.0 (default: 0.7)
  max_tokens?: number            // Max response tokens
  top_p?: number                 // Nucleus sampling parameter
}
```

#### Response (Streaming)
```typescript
// Server-Sent Events format
data: {"type": "content", "content": "Hello"}
data: {"type": "content", "content": " there!"}
data: {"type": "done", "finishReason": "stop"}
```

#### Response (Non-Streaming)
```typescript
{
  content: string
  finishReason: 'stop' | 'length' | 'content_filter'
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}
```

#### Error Responses
```typescript
{
  error: string
  details?: string
  code?: 'INVALID_MODEL' | 'RATE_LIMITED' | 'API_ERROR'
}
```

### 2. Models Endpoint
**GET** `/api/models`

Retrieves available AI models from OpenRouter.

#### Query Parameters
- `refresh?: boolean` - Force refresh model cache

#### Response
```typescript
{
  models: Array<{
    id: string
    name: string
    description: string
    pricing: {
      prompt: string      // Cost per token
      completion: string  // Cost per token
    }
    context_length: number
    architecture: {
      modality: string
      tokenizer: string
      instruct_type?: string
    }
    top_provider: {
      max_completion_tokens?: number
      is_moderated: boolean
    }
  }>
  favorites: string[]     // Curated model IDs
  cached: boolean        // Whether response was cached
}
```

### 3. Summarize Endpoint
**POST** `/api/summarize`

Generates intelligent summaries of chat conversations.

#### Request Body
```typescript
{
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  sessionId: string
}
```

#### Response
```typescript
{
  summary: string
  topics: string[]       // Extracted key topics
  messageCount: number   // Number of messages summarized
}
```

### 4. Database Test Endpoint
**GET** `/api/database-test`

Health check and testing endpoint for database operations.

#### Response
```typescript
{
  status: 'success' | 'error'
  supabase: {
    hasUrl: boolean
    hasKey: boolean
    isConfigured: boolean
  }
  operations: {
    createSession: boolean
    readSession: boolean
    updateSession: boolean
    deleteSession: boolean
    createSummary: boolean
    readSummary: boolean
  }
  testResults: {
    sessionId: string
    summaryId: string
    cleanup: boolean
  }
  timestamp: string
}
```

### 5. Debug Endpoint
**GET** `/api/debug`

Development endpoint for system diagnostics.

#### Response
```typescript
{
  environment: {
    nodeEnv: string
    hasOpenRouter: boolean
    hasSupabase: boolean
    hasDatabaseUrl: boolean
  }
  buildInfo: {
    nextVersion: string
    buildTime: string
  }
  performance: {
    uptime: number
    memoryUsage: NodeJS.MemoryUsage
  }
}
```

## Core Services

### ChatService

Central service managing chat persistence and lifecycle.

```typescript
class ChatService {
  // Initialize new chat session
  async initializeSession(initialMessage?: string): Promise<string>
  
  // Save messages to database
  async saveMessages(sessionId: string, messages: Message[]): Promise<void>
  
  // Load chat history
  async loadChatHistory(sessionId: string): Promise<Message[]>
  
  // Handle chat inactivity (auto-summarize after 10min)
  setupInactivityHandler(sessionId: string, onSummarize: () => void): void
  
  // Summarize and end chat session
  async summarizeAndEndChat(sessionId: string, messages: Message[]): Promise<string>
}
```

### OpenRouterClient

Client for OpenRouter AI API integration.

```typescript
class OpenRouterClient {
  // Stream chat completion
  async streamChatCompletion(params: {
    messages: Message[]
    model: string
    temperature?: number
    max_tokens?: number
    stream?: boolean
  }): Promise<ReadableStream>
  
  // Get available models
  async getModels(refresh?: boolean): Promise<OpenRouterModel[]>
  
  // Get model pricing and info
  async getModelInfo(modelId: string): Promise<OpenRouterModel>
}
```

### Database Operations

Type-safe database operations using Drizzle ORM.

```typescript
// Chat Sessions
async function createChatSession(data: {
  id: string
  title?: string
  messages: Message[]
}): Promise<ChatSession>

async function getChatSession(id: string): Promise<ChatSession | null>

async function updateChatSession(id: string, data: Partial<ChatSession>): Promise<void>

// Chat Summaries  
async function createChatSummary(data: {
  sessionId: string
  summary: string
  topics: string[]
  messageCount: number
}): Promise<ChatSummary>

async function getChatSummaries(sessionId: string): Promise<ChatSummary[]>
```

## Database Schema

### Tables

#### chat_sessions
```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);
```

#### chat_summaries
```sql
CREATE TABLE chat_summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes
- `idx_chat_sessions_created_at` - Performance for recent chats
- `idx_chat_sessions_active` - Filter active sessions
- `idx_chat_summaries_session_id` - Join performance
- `idx_chat_summaries_created_at` - Chronological ordering

## Environment Variables

### Required
```bash
# OpenRouter API (AI Models)
OPENROUTER_API_KEY=sk_or_...

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# Application
NEXT_PUBLIC_APP_URL=http://localhost:12000
```

### Optional
```bash
# Development
NODE_ENV=development
NEXT_PUBLIC_DEBUG=true
```

## Error Handling

### Standard Error Format
```typescript
{
  error: string           // Human-readable error message
  details?: string        // Technical details (development only)
  code?: string          // Error code for programmatic handling
  timestamp: string      // ISO timestamp
}
```

### Common Error Codes
- `INVALID_API_KEY` - OpenRouter API key invalid/missing
- `INVALID_MODEL` - Requested model not available
- `RATE_LIMITED` - API rate limit exceeded
- `DATABASE_ERROR` - Supabase connection/query failed
- `VALIDATION_ERROR` - Request payload validation failed
- `STREAM_ERROR` - Streaming response interrupted

## Rate Limiting

### OpenRouter Limits
- **Free Tier**: 20 requests/minute
- **Paid Tier**: Varies by model and plan
- **Best Practice**: Implement client-side debouncing

### Implementation
```typescript
// Client-side debouncing example
const debouncedSend = useMemo(
  () => debounce(sendMessage, 500),
  [sendMessage]
);
```

## Authentication Flow

Currently operates without user authentication. Database uses anonymous access with Row Level Security (RLS) policies prepared for future auth integration.

### Future Auth Integration
```typescript
// When implementing auth
const { data: session } = await supabase.auth.getSession();
const userId = session?.user?.id;

// RLS policies will automatically filter by user_id
```

## WebSocket Events (Future)

Planned real-time features:

```typescript
// Client events
socket.emit('join_session', { sessionId });
socket.emit('typing_start', { sessionId });
socket.emit('typing_stop', { sessionId });

// Server events  
socket.on('user_joined', { userId, sessionId });
socket.on('user_typing', { userId, sessionId });
socket.on('message_received', { message, sessionId });
```

## Performance Considerations

### Caching Strategy
- **Models**: 1-hour cache with refresh capability
- **Sessions**: No caching (real-time updates)
- **Static Assets**: CDN with 1-year expiry

### Database Optimization
- Connection pooling via Supabase
- Prepared statements with Drizzle ORM
- Automatic indexing on foreign keys
- JSONB for flexible message storage

### Memory Management
- Streaming responses prevent large memory usage
- Automatic cleanup of inactive sessions
- Pagination for chat history (future)

## Development Tools

### Environment Validation
```bash
npm run check-env    # Validate environment setup
npm run setup        # Interactive environment setup
```

### Database Tools
```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio
```

### Testing
```bash
npm run type-check   # TypeScript validation
npm run lint         # ESLint checking
npm run build        # Production build test
```

## Monitoring & Debugging

### Health Checks
- `GET /api/debug` - System diagnostics
- `GET /api/database-test` - Database connectivity
- Environment validation at startup

### Logging
```typescript
// Structured logging example
console.log('[CHAT]', {
  sessionId,
  messageCount,
  model,
  timestamp: new Date().toISOString()
});
```

### Error Tracking
Integration ready for services like:
- Sentry (error tracking)
- LogRocket (session replay)
- Vercel Analytics (performance)

## Security Best Practices

### API Security
- API keys stored securely in environment
- Input validation with Zod schemas
- SQL injection prevention via ORM
- Rate limiting implementation ready

### Data Protection
- No PII storage without explicit consent
- Chat data encrypted at rest (Supabase)
- HTTPS enforcement in production
- CORS properly configured

## Migration Guide

### From Development to Production
1. Set production environment variables
2. Run database migrations: `npm run db:migrate`
3. Enable RLS policies in Supabase
4. Configure custom domain and SSL
5. Set up monitoring and alerting

### Version Compatibility
- Node.js 18+ required
- Next.js 15+ for App Router
- React 19+ for concurrent features
- PostgreSQL 13+ for JSONB support

---

## Support & Contributing

For questions or contributions:
1. Check existing GitHub issues
2. Review this documentation
3. Test with `/api/debug` endpoint
4. Include relevant logs and environment info

Happy coding! 🦆 