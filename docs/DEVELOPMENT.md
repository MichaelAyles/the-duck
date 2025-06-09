# The Duck Development Workflow 🦆

## Overview

This guide covers the complete development workflow for The Duck, from initial setup to deployment. Follow these practices to maintain code quality and ensure smooth collaboration.

## Getting Started

### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-username/the-duck.git
cd the-duck

# Install dependencies
npm install

# Setup environment
npm run setup

# Start development server
npm run dev
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local

# Required environment variables
OPENROUTER_API_KEY=sk_or_your_api_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
NEXT_PUBLIC_APP_URL=http://localhost:12000

# Validate environment
npm run check-env
```

### 3. Database Setup

```bash
# Run database migrations
npm run db:migrate

# Open database studio (optional)
npm run db:studio

# Test database connectivity
curl http://localhost:12000/api/database-test
```

## Development Standards

### 1. Code Style

**TypeScript Requirements:**
```typescript
// ✅ Good: Explicit types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

// ❌ Bad: Any types
const message: any = { ... };

// ✅ Good: Proper error handling
try {
  const result = await apiCall();
  return result;
} catch (error) {
  console.error('API call failed:', error);
  throw new Error('Operation failed');
}
```

**React Patterns:**
```typescript
// ✅ Good: Custom hooks for logic
const useChatMessages = (sessionId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // ... logic
  return { messages, addMessage, clearMessages };
};

// ✅ Good: Memoization for expensive operations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(dependencies);
}, [dependencies]);

// ✅ Good: Cleanup in useEffect
useEffect(() => {
  const timer = setTimeout(() => {}, 1000);
  return () => clearTimeout(timer);
}, []);
```

### 2. File Organization

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── chat/             # Chat-specific components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── db/               # Database operations
│   ├── utils.ts          # General utilities
│   └── env.ts            # Environment validation
└── types/                # TypeScript type definitions
```

### 3. Naming Conventions

```typescript
// Files: kebab-case
chat-interface.tsx
database-operations.ts

// Components: PascalCase
const ChatInterface = () => { ... };
const MessageBubble = () => { ... };

// Functions: camelCase
const handleSendMessage = () => { ... };
const validateEnvironment = () => { ... };

// Constants: SCREAMING_SNAKE_CASE
const DEFAULT_MODEL = 'anthropic/claude-3-sonnet';
const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

// Types/Interfaces: PascalCase
interface ChatSession { ... }
type MessageRole = 'user' | 'assistant';
```

## Development Workflow

### 1. Feature Development

**Branch Strategy:**
```bash
# Create feature branch
git checkout -b feature/chat-history

# Work on feature
git add .
git commit -m "feat: add chat history persistence"

# Push for review
git push origin feature/chat-history
```

**Commit Messages:**
```bash
# Format: type(scope): description
feat(chat): add message persistence
fix(api): handle OpenRouter rate limits
docs(readme): update setup instructions
refactor(components): extract message bubble
test(api): add integration tests
chore(deps): update dependencies
```

### 2. Code Quality Checks

**Pre-commit Checks:**
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Auto-fix issues
npm run lint -- --fix

# Build test
npm run build
```

**Automated Quality Gates:**
```json
// package.json scripts
{
  "scripts": {
    "pre-commit": "npm run type-check && npm run lint && npm run test",
    "pre-push": "npm run build && npm run test:e2e"
  }
}
```

### 3. Testing Strategy

**Unit Tests:**
```typescript
// Example: testing utility functions
import { extractTopics } from '@/lib/utils';

describe('extractTopics', () => {
  it('should extract topics from text', () => {
    const text = 'Discussion about React hooks and TypeScript';
    const topics = extractTopics(text);
    expect(topics).toContain('React');
    expect(topics).toContain('TypeScript');
  });
});
```

**Integration Tests:**
```typescript
// Example: testing API endpoints
describe('/api/chat', () => {
  it('should handle chat completion', async () => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'test-model'
      })
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('content');
  });
});
```

**Component Tests:**
```typescript
// Example: testing React components
import { render, screen } from '@testing-library/react';
import { ChatInterface } from '@/components/chat/chat-interface';

describe('ChatInterface', () => {
  it('should render message input', () => {
    render(<ChatInterface />);
    const input = screen.getByPlaceholderText(/type your message/i);
    expect(input).toBeInTheDocument();
  });
});
```

## Quick Reference

### Essential Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run type-check   # TypeScript validation
npm run lint         # Code linting
npm run check-env    # Environment validation
npm run db:migrate   # Run database migrations
npm run db:studio    # Open database studio
```

### Key Directories
- `src/app/api/` - API routes
- `src/components/` - React components
- `src/lib/` - Utility libraries
- `docs/` - Documentation
- `drizzle/` - Database migrations

### Important Files
- `.env.local` - Environment variables
- `drizzle.config.ts` - Database configuration
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` - Styling configuration

Happy coding! 🦆✨ 