# Application Flow Documentation

This document provides comprehensive flow diagrams for The Duck chat application, including API calls, database interactions, caching strategies, and potential race conditions.

## 1. Authentication Flow

The complete authentication lifecycle from application start to user logout.

```mermaid
sequenceDiagram
    participant Client as Client (Browser)
    participant AuthProvider as React (AuthProvider)
    participant Middleware as Next.js Middleware
    participant API as API Routes
    participant Supabase as Supabase (Backend)
    participant Redis as Redis Cache

    Client->>AuthProvider: App mounts, AuthProvider initializes
    AuthProvider->>AuthProvider: Set loading = true, user = null
    AuthProvider->>AuthProvider: Check if Supabase configured
    
    alt Supabase Configured
        AuthProvider->>AuthProvider: Start 1-second timeout
        AuthProvider->>Supabase: supabase.auth.getSession()
        
        par Potential Race Condition
            Note over AuthProvider: Timeout vs getSession() race
            AuthProvider-->>AuthProvider: Timeout (1s) → loading = false
        and
            Supabase-->>AuthProvider: Session response
            AuthProvider->>AuthProvider: Update user, session, loading = false
        end
        
        AuthProvider->>Supabase: supabase.auth.onAuthStateChange()
        Supabase-->>AuthProvider: Auth state listener established
    else
        AuthProvider->>AuthProvider: Set loading = false
    end

    Note over Client, Redis: User Navigation Flow
    Client->>API: Request to protected route
    API->>Supabase: createClient().auth.getUser()
    Supabase-->>API: User session validation
    
    alt Authenticated
        API->>Redis: Check rate limits
        Redis-->>API: Rate limit status
        API-->>Client: Protected resource
    else Unauthorized
        API-->>Client: 401 Unauthorized
    end

    Note over Client, Supabase: Logout Flow
    Client->>AuthProvider: logout() called
    AuthProvider->>Supabase: supabase.auth.signOut()
    Supabase-->>AuthProvider: Sign out success
    AuthProvider->>AuthProvider: Reset user = null, session = null
```

## 2. Chat Session Management Flow

Complete session lifecycle from creation to persistence with caching layers.

```mermaid
sequenceDiagram
    participant UI as Chat Interface
    participant Hook as useChatSession
    participant Service as ChatService
    participant LocalCache as Local Storage
    participant API as /api/sessions
    participant Redis as Redis Cache
    participant DB as Supabase DB

    Note over UI, DB: Session Creation Flow
    UI->>Hook: User starts new chat
    Hook->>Hook: Generate UUID sessionId
    Hook->>Service: new ChatService(sessionId, userId)
    Hook->>LocalCache: Cache session immediately
    
    alt User Authenticated
        Hook->>API: POST /api/sessions (empty session)
        API->>DB: Insert new session record
        API->>Redis: Cache session (10min TTL)
        API-->>Hook: Session created
    end

    Note over UI, DB: Session Loading Flow
    UI->>Hook: Load existing session
    Hook->>Hook: Check lastLoadedSessionId (deduplication)
    Hook->>LocalCache: Check local cache first
    
    alt Cache Hit (fresh < 5min)
        LocalCache-->>Hook: Return cached session
    else Cache Miss/Stale
        Hook->>API: GET /api/sessions/{sessionId}
        API->>Redis: Check Redis cache
        
        alt Redis Hit
            Redis-->>API: Return cached session
        else Redis Miss
            API->>DB: Query chat_sessions table
            DB-->>API: Session data with messages
            API->>Redis: Cache for 10 minutes
        end
        
        API-->>Hook: Session with messages array
        Hook->>LocalCache: Update local cache
    end

    Hook->>Hook: Parse messages, detect artifacts
    Hook->>UI: Display messages with welcome message

    Note over UI, DB: Session Saving Flow
    Hook->>Service: saveChatSession(messages, model, title)
    Service->>Service: Retry logic (3 attempts, exponential backoff)
    
    loop Retry Logic
        Service->>API: POST /api/sessions (upsert)
        API->>DB: Upsert session with messages array
        API->>Redis: Invalidate cache
        API->>LocalCache: Update cache optimistically
        
        alt Save Success
            API-->>Service: Success response
        else Save Failure
            Service->>Service: Wait (200ms * 2^attempt)
            Note over Service: Continue retry loop
        end
    end
```

## 3. Message Handling and Streaming Flow

Real-time message processing with Server-Sent Events streaming.

```mermaid
sequenceDiagram
    participant UI as Chat Interface
    participant MessageHook as useMessageHandling
    participant ChatService as ChatService
    participant API as /api/chat
    participant Security as Security Middleware
    participant Redis as Redis Cache
    participant OpenRouter as OpenRouter API
    participant DB as Supabase DB

    Note over UI, DB: Message Send Flow
    UI->>MessageHook: User sends message
    MessageHook->>MessageHook: Validate input, lock session
    MessageHook->>UI: Optimistic UI update (user + thinking message)
    
    par Background Operations
        MessageHook->>ChatService: Cache session locally
        MessageHook->>API: Extract learning preferences
        MessageHook->>API: Link file attachments
    and Main Chat Flow
        MessageHook->>API: POST /api/chat (streaming)
        
        Note over API, Redis: Security & Rate Limiting
        API->>Security: withSecurity middleware
        API->>Security: withRateLimit (100 req/15min)
        API->>Security: withApiKeyValidation  
        API->>Security: withInputValidation
        
        Security->>Redis: Check rate limits (distributed)
        Redis-->>Security: Rate limit status
        
        alt Rate Limited
            Security-->>MessageHook: 429 Too Many Requests
        else Within Limits
            API->>DB: Check user credits/authentication
            API->>API: Load learning preferences
            API->>API: Fetch memory context
            
            API->>OpenRouter: Stream chat request
            OpenRouter-->>API: SSE stream chunks
            
            Note over API, MessageHook: Server-Sent Events
            API-->>MessageHook: 'Content-Type: text/event-stream'
            
            loop Streaming Response
                OpenRouter->>API: Response chunk
                API->>API: Format as SSE: 'data: {content}\n\n'
                API-->>MessageHook: Stream chunk
                MessageHook->>MessageHook: Parse SSE data
                MessageHook->>UI: Update message content incrementally
            end
            
            API->>API: Send completion: 'data: [DONE]\n\n'
            API-->>MessageHook: Stream complete
        end
    end

    Note over MessageHook, DB: Completion Flow
    MessageHook->>MessageHook: Hide thinking state (min 800ms)
    MessageHook->>MessageHook: Process artifacts (100ms delay)
    MessageHook->>ChatService: Save complete session (100ms delay)
    MessageHook->>MessageHook: Unlock session
    
    alt Save Failure
        MessageHook->>UI: Show warning toast
    else Save Success
        MessageHook->>UI: Update complete
    end
```

## 4. User Preferences and Settings Flow

Multi-tier caching strategy for user preferences and settings.

```mermaid
sequenceDiagram
    participant UI as Settings UI
    participant Hook as useChatSettings
    participant LocalCache as Local Storage
    participant RequestCache as Request Cache
    participant API as /api/user/preferences
    participant Redis as Redis Cache
    participant DB as Supabase DB

    Note over UI, DB: Preferences Loading
    UI->>Hook: Load user preferences
    Hook->>LocalCache: Check localStorage (10min TTL)
    
    alt Local Cache Hit (Fresh)
        LocalCache-->>Hook: Return cached preferences
        Hook->>Hook: Validate cache belongs to current user
        Hook->>UI: Display preferences immediately
    else Local Cache Miss/Stale
        Hook->>RequestCache: Check in-flight requests (5min TTL)
        
        alt Request Cache Hit
            RequestCache-->>Hook: Return cached promise
        else Request Cache Miss
            Hook->>API: GET /api/user/preferences
            Hook->>RequestCache: Cache request promise
            
            API->>Redis: Check Redis cache (30min TTL)
            
            alt Redis Hit
                Redis-->>API: Return cached preferences
            else Redis Miss
                API->>DB: Query user_preferences table
                DB-->>API: User preferences data
                API->>Redis: Cache for 30 minutes
            end
            
            API-->>Hook: Preferences response
        end
        
        Hook->>LocalCache: Update localStorage cache
        Hook->>UI: Display preferences
    end

    Note over UI, DB: Preferences Update Flow
    UI->>Hook: User changes setting
    Hook->>Hook: Optimistic update (immediate UI change)
    Hook->>LocalCache: Update localStorage immediately
    
    Hook->>API: POST /api/user/preferences
    API->>DB: Update user_preferences table
    API->>Redis: Invalidate cache key
    
    alt Update Success
        API-->>Hook: Success response
        Hook->>UI: Confirm update
    else Update Failure
        Hook->>Hook: Rollback optimistic update
        Hook->>LocalCache: Restore previous values
        Hook->>UI: Show error toast
    end
```

## 5. Model Catalog and Selection Flow

Dynamic model loading with ranking and caching strategies.

```mermaid
sequenceDiagram
    participant UI as Model Selector
    participant Hook as useStarredModels
    participant API as /api/models
    participant SearchAPI as /api/search-models
    participant OpenRouter as OpenRouter API
    participant Redis as Redis Cache
    participant DB as Supabase DB

    Note over UI, DB: Model Catalog Loading
    UI->>Hook: User opens model selector
    Hook->>API: GET /api/models?type=curated
    
    API->>Redis: Check models cache (1hr TTL)
    
    alt Redis Cache Hit
        Redis-->>API: Return cached model catalog
    else Redis Cache Miss
        API->>OpenRouter: GET /models
        
        alt OpenRouter Success
            OpenRouter-->>API: Complete model catalog
            API->>API: Enrich with rankings & metadata
        else OpenRouter Failure/No Key
            API->>API: Return DEFAULT_ACTIVE_MODELS with estimates
        end
        
        API->>Redis: Cache for 1 hour
    end
    
    API->>DB: Get user's starred models
    API->>API: Filter to user's curated models (top 5)
    API-->>Hook: Curated models list
    Hook->>UI: Display starred models

    Note over UI, DB: Advanced Model Search
    UI->>UI: User clicks "All Models" or uses search
    UI->>SearchAPI: GET /api/search-models?query=...&provider=...
    
    SearchAPI->>Redis: Check models cache
    SearchAPI->>API: Get full model catalog (cached)
    SearchAPI->>SearchAPI: Apply filters (provider, cost, context)
    SearchAPI->>SearchAPI: Apply text search & ranking:
    Note over SearchAPI: 1. DEFAULT_ACTIVE_MODELS priority<br/>2. Context length (higher better)<br/>3. Provider ranking<br/>4. Alphabetical
    
    SearchAPI-->>UI: Filtered & ranked results
    UI->>UI: Display paginated results (20 in dropdown)

    Note over UI, DB: Model Selection & Starring
    UI->>Hook: User selects/stars model
    Hook->>Hook: Optimistic UI update
    Hook->>API: POST /api/starred-models
    
    API->>DB: Update user_preferences.starred_models[]
    API->>Redis: Invalidate user preferences cache
    
    alt Update Success
        API-->>Hook: Success
        Hook->>UI: Confirm selection
    else Update Failure
        Hook->>Hook: Rollback optimistic change
        Hook->>UI: Show error toast
    end
```

## 6. Chat Lifecycle and Cleanup Flow

Comprehensive lifecycle management with inactivity handling and cleanup.

```mermaid
sequenceDiagram
    participant UI as Chat Interface
    participant LifecycleHook as useChatLifecycle
    participant ChatService as ChatService
    participant SummaryAPI as /api/summarize
    participant Timer as Inactivity Timer
    participant DB as Supabase DB

    Note over UI, DB: Chat Lifecycle Setup
    UI->>LifecycleHook: Component mounts
    LifecycleHook->>ChatService: setupInactivityHandler()
    ChatService->>Timer: setTimeout(10 minutes)
    
    Note over Timer: User Activity Monitoring
    UI->>ChatService: User sends message
    ChatService->>Timer: clearTimeout() - reset timer
    ChatService->>Timer: setTimeout(10 minutes) - restart
    
    Note over Timer, DB: Inactivity Timeout Flow
    Timer->>LifecycleHook: Timeout triggered (10 min)
    LifecycleHook->>LifecycleHook: Check messages.length > 1
    
    alt Has Meaningful Conversation
        LifecycleHook->>UI: Set isProcessingStorage(true)
        LifecycleHook->>ChatService: Get current session title
        
        alt User Authenticated & Storage Enabled
            LifecycleHook->>SummaryAPI: POST /api/summarize
            SummaryAPI->>SummaryAPI: Use cost-effective model
            SummaryAPI-->>LifecycleHook: Summary with key topics
            LifecycleHook->>DB: Save chat summary
        end
        
        LifecycleHook->>LifecycleHook: Clear messages array
        LifecycleHook->>ChatService: createNewSession(preservedTitle)
        LifecycleHook->>UI: onSessionUpdate(newSessionId)
        LifecycleHook->>UI: Set isProcessingStorage(false)
        LifecycleHook->>UI: Show success toast
    else Welcome Only Chat
        Note over LifecycleHook: Skip ending - no meaningful content
    end

    Note over UI, DB: Manual Chat End
    UI->>LifecycleHook: User clicks "End Chat"
    Note over LifecycleHook, DB: Same flow as inactivity timeout

    Note over UI, Timer: Component Cleanup
    UI->>LifecycleHook: Component unmounting
    LifecycleHook->>Timer: clearTimeout() - captured in closure
    LifecycleHook->>ChatService: clearInactivityTimer()
    
    Note over LifecycleHook: Additional Timer Cleanup
    LifecycleHook->>LifecycleHook: Clear welcomeMessageTimer
    LifecycleHook->>LifecycleHook: Clear artifactProcessingTimer  
    LifecycleHook->>LifecycleHook: Clear saveTimer
    LifecycleHook->>LifecycleHook: Set all timer refs to null
```

## 7. Security and Rate Limiting Flow

Multi-layered security architecture with distributed rate limiting.

```mermaid
sequenceDiagram
    participant Client as Client Request
    participant Middleware as Next.js Middleware
    participant Security as Security Middleware
    participant RateLimit as Rate Limiter
    participant Redis as Redis Cache
    participant API as API Handler
    participant Validation as Input Validation

    Note over Client, Validation: Request Security Pipeline
    Client->>Middleware: API request
    Middleware->>Middleware: Apply CORS headers
    Middleware->>Middleware: Add security headers
    Middleware->>Security: withSecurity wrapper
    
    Security->>RateLimit: withRateLimit (Redis-based)
    RateLimit->>Redis: Check rate limit key
    Redis-->>RateLimit: Current request count
    
    alt Rate Limit Exceeded
        RateLimit-->>Client: 429 Too Many Requests + Retry-After
    else Within Limits
        RateLimit->>Redis: Increment counter (sliding window)
        RateLimit->>Security: Continue to next middleware
        
        Security->>Validation: withInputValidation (Zod schemas)
        Validation->>Validation: Validate request body/params
        
        alt Validation Failed
            Validation-->>Client: 400 Bad Request + error details
        else Validation Passed
            Validation->>API: withApiKeyValidation (OpenRouter)
            API->>API: Verify authentication (Supabase)
            
            alt Unauthorized
                API-->>Client: 401 Unauthorized
            else Authorized
                API->>API: Execute protected business logic
                API-->>Client: Success response
            end
        end
    end

    Note over Redis: Rate Limiting Configuration
    Note over Redis: Chat: 100 req/15min<br/>Models: 100 req/15min<br/>Search: 500 req/15min<br/>General: 1000 req/15min
```

## Key Performance Optimizations

### Caching Strategy Summary
- **Local Storage**: 5-10 minute TTL, instant access, user-specific validation
- **Request Cache**: 5 minute TTL, deduplicates concurrent requests  
- **Redis Cache**: 10-60 minute TTL, distributed across serverless instances
- **Database**: Row-Level Security, optimized indexes, JSONB for preferences

### Race Condition Prevention
- **Session Locking**: Prevents concurrent session modifications
- **Operation Tracking**: `isOperationInProgress` refs prevent duplicate operations
- **Cleanup Functions**: Captured closures ensure proper timer cleanup
- **Retry Logic**: Exponential backoff for critical operations (session saves)

### Error Handling Patterns
- **Graceful Degradation**: System continues with reduced functionality on failures
- **User Feedback**: Toast notifications for all critical operations
- **Retry Mechanisms**: Automatic retry with exponential backoff
- **Rollback Logic**: Optimistic updates can be reverted on failures

### Security Measures
- **Zero Client DB Access**: All database operations through authenticated API routes
- **Input Validation**: Comprehensive Zod schemas for all inputs
- **Rate Limiting**: Distributed Redis-based limiting with different tiers
- **Authentication**: Supabase Auth with Row-Level Security policies