# The Duck Troubleshooting Guide 🦆

## Quick Diagnostics

If you're experiencing issues, start here:

```bash
# 1. Check environment setup
npm run check-env

# 2. Test database connectivity  
curl http://localhost:12000/api/database-test

# 3. Verify build integrity
npm run type-check && npm run lint

# 4. Check system status
curl http://localhost:12000/api/debug
```

## Common Issues & Solutions

### 1. Development Server Won't Start

#### Symptoms
- `'next' is not recognized as an internal or external command`
- `npm run dev` fails

#### Diagnosis
```bash
# Check if dependencies are installed
ls node_modules/ | head -10

# Check package.json
cat package.json | grep "next"
```

#### Solutions
```bash
# Install dependencies
npm install

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version  # Should be 18+
```

### 2. Environment Variables Issues

#### Symptoms
- API calls failing
- Database connection errors
- "Environment validation failed" messages

#### Diagnosis
```bash
# Run environment check
npm run check-env

# Check specific variables
echo $OPENROUTER_API_KEY
echo $NEXT_PUBLIC_SUPABASE_URL
```

#### Solutions

**Missing Variables:**
```bash
# Create .env.local file
cp .env.example .env.local

# Add required variables
cat > .env.local << EOF
OPENROUTER_API_KEY=sk_or_your_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
NEXT_PUBLIC_APP_URL=http://localhost:12000
EOF
```

**Invalid Format:**
```bash
# Check API key format
if [[ $OPENROUTER_API_KEY =~ ^sk_or_ ]]; then
  echo "✅ API key format correct"
else
  echo "❌ API key should start with 'sk_or_'"
fi

# Check Supabase URL format
if [[ $NEXT_PUBLIC_SUPABASE_URL =~ ^https://.*\.supabase\.co$ ]]; then
  echo "✅ Supabase URL format correct" 
else
  echo "❌ Supabase URL format invalid"
fi
```

### 3. Database Connection Problems

#### Symptoms
- "Failed to connect to database"
- Chat messages not saving
- 500 errors on API endpoints

#### Diagnosis
```bash
# Test database endpoint
curl -s http://localhost:12000/api/database-test | jq

# Check database directly (if you have psql)
psql $DATABASE_URL -c "SELECT version();"
```

#### Solutions

**Connection String Issues:**
```bash
# Verify DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# Test connection components
node -e "
const url = new URL(process.env.DATABASE_URL);
console.log('Host:', url.hostname);
console.log('Port:', url.port);
console.log('Database:', url.pathname.slice(1));
"
```

**Missing Tables:**
```bash
# Run migrations
npm run db:migrate

# Or manually create tables in Supabase dashboard
# Copy SQL from drizzle/0000_flippant_korg.sql
```

**Network Issues:**
```bash
# Test Supabase connectivity
curl -I https://your-project.supabase.co

# Check firewall/proxy settings
echo "If behind corporate firewall, ensure *.supabase.co is allowed"
```

### 4. OpenRouter API Issues

#### Symptoms
- "Invalid API key" errors
- Chat responses not generating
- Rate limit errors

#### Diagnosis
```bash
# Test API key
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
     https://openrouter.ai/api/v1/models | jq '.data[0].id'
```

#### Solutions

**Invalid API Key:**
```bash
# Get new API key from https://openrouter.ai/keys
# Update .env.local
sed -i 's/OPENROUTER_API_KEY=.*/OPENROUTER_API_KEY=sk_or_new_key/' .env.local

# Restart development server
npm run dev
```

**Rate Limiting:**
```javascript
// Add request debouncing in your code
const debouncedSend = useMemo(
  () => debounce(handleSendMessage, 1000), // 1 second delay
  [handleSendMessage]
);
```

**Model Not Available:**
```bash
# Check available models
curl http://localhost:12000/api/models | jq '.models[].id'

# Use a different model
# Update your model selection in the UI
```

### 5. Build & Deployment Errors

#### Symptoms
- `npm run build` fails
- TypeScript compilation errors
- Lint failures

#### Diagnosis
```bash
# Check TypeScript errors
npm run type-check

# Check lint errors
npm run lint

# Check for missing dependencies
npm audit
```

#### Solutions

**TypeScript Errors:**
```bash
# Common fixes
npm install @types/node @types/react @types/react-dom --save-dev

# Fix strict mode issues
# Edit tsconfig.json
{
  "compilerOptions": {
    "strict": false,  // Temporarily disable for quick fix
    "noImplicitAny": false
  }
}
```

**ESLint Errors:**
```bash
# Auto-fix simple issues
npm run lint -- --fix

# Disable specific rules (temporary)
/* eslint-disable @typescript-eslint/no-unused-vars */

# Update ESLint config for common patterns
```

**Build Optimization:**
```bash
# Clear Next.js cache
rm -rf .next

# Analyze bundle size
ANALYZE=true npm run build

# Check for circular dependencies
npm install --save-dev madge
npx madge --circular src/
```

### 6. UI/UX Issues

#### Symptoms
- Components not rendering
- Styling problems
- Dark mode issues

#### Diagnosis
```bash
# Check browser console for errors
# Open DevTools → Console

# Check component tree
# React DevTools → Components

# Verify Tailwind classes
# Elements tab → Check computed styles
```

#### Solutions

**Missing Components:**
```bash
# Reinstall UI components
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu

# Check component imports
grep -r "import.*from.*@radix-ui" src/
```

**Theme Issues:**
```javascript
// Debug theme state
console.log('Current theme:', document.documentElement.classList);
console.log('Theme preference:', localStorage.getItem('theme'));

// Reset theme
localStorage.removeItem('theme');
window.location.reload();
```

**Tailwind Problems:**
```bash
# Rebuild Tailwind
npm run build

# Check Tailwind config
cat tailwind.config.ts

# Verify PostCSS setup
cat postcss.config.mjs
```

### 7. Performance Issues

#### Symptoms
- Slow page loads
- High memory usage
- Sluggish interactions

#### Diagnosis
```bash
# Check bundle size
npm run build
# Look for "First Load JS" metrics

# Profile in browser
# DevTools → Performance → Record

# Check memory usage
# DevTools → Memory → Take snapshot
```

#### Solutions

**Bundle Optimization:**
```javascript
// Add dynamic imports
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Optimize images
import Image from 'next/image';
<Image src="/logo.png" width={100} height={100} alt="Logo" />

// Split vendor bundles
// next.config.ts
module.exports = {
  webpack: (config) => {
    config.optimization.splitChunks.chunks = 'all';
    return config;
  }
};
```

**Memory Leaks:**
```javascript
// Clean up timers
useEffect(() => {
  const timer = setTimeout(() => {}, 1000);
  return () => clearTimeout(timer);
}, []);

// Remove event listeners
useEffect(() => {
  const handler = () => {};
  window.addEventListener('scroll', handler);
  return () => window.removeEventListener('scroll', handler);
}, []);
```

**Database Performance:**
```sql
-- Check slow queries in Supabase
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_chat_sessions_created 
ON chat_sessions(created_at DESC);
```

## Debug Tools & Techniques

### 1. Environment Debugging

```bash
# Custom debug script
cat > debug.js << 'EOF'
const env = process.env;

console.log('🔍 Environment Debug Report');
console.log('Node.js:', process.version);
console.log('OS:', process.platform);

// Check required variables
const required = [
  'OPENROUTER_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'DATABASE_URL'
];

required.forEach(key => {
  const value = env[key];
  console.log(`${key}:`, value ? '✅ Set' : '❌ Missing');
  if (value && key.includes('API_KEY')) {
    console.log(`  Format: ${value.slice(0, 10)}...`);
  }
});
EOF

node debug.js
```

### 2. Network Debugging

```bash
# Test all endpoints
endpoints=(
  "/api/debug"
  "/api/database-test" 
  "/api/models"
  "/api/chat"
)

for endpoint in "${endpoints[@]}"; do
  echo "Testing $endpoint..."
  curl -s -w "%{http_code}\n" "http://localhost:12000$endpoint" | tail -1
done
```

### 3. Database Debugging

```sql
-- Check table existence
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('chat_sessions', 'chat_summaries');

-- Check data
SELECT COUNT(*) as sessions FROM chat_sessions;
SELECT COUNT(*) as summaries FROM chat_summaries;
```

### 4. API Debugging

```javascript
// Add request logging
const originalFetch = fetch;
global.fetch = async (...args) => {
  console.log('[FETCH]', args[0]);
  const response = await originalFetch(...args);
  console.log('[RESPONSE]', response.status, response.statusText);
  return response;
};

// Enable verbose logging
localStorage.setItem('debug', 'true');
localStorage.setItem('debug_api', 'true');
```

### 5. React Debugging

```javascript
// Debug component renders
const DebugComponent = ({ children, name }) => {
  console.log(`[RENDER] ${name}`, new Date().toISOString());
  return children;
};

// Profile expensive operations
const expensiveOperation = () => {
  console.time('expensive-op');
  // ... operation
  console.timeEnd('expensive-op');
};

// Track state changes
useEffect(() => {
  console.log('[STATE]', { messages: messages.length, sessionId });
}, [messages, sessionId]);
```

## Production Debugging

### 1. Vercel Logs

```bash
# Install Vercel CLI
npm install -g vercel

# View logs
vercel logs your-project-name

# Follow real-time logs
vercel logs --follow your-project-name
```

### 2. Supabase Logs

```bash
# View in Supabase dashboard
# Go to Logs → API or Database

# Query logs programmatically
curl -H "apikey: your-service-key" \
  "https://your-project.supabase.co/rest/v1/logs"
```

### 3. Error Tracking

```javascript
// Add error boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('[ERROR BOUNDARY]', error, errorInfo);
    
    // Send to monitoring service
    if (typeof window !== 'undefined') {
      fetch('/api/error-report', {
        method: 'POST',
        body: JSON.stringify({ error: error.message, stack: error.stack })
      });
    }
  }
  
  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please refresh the page.</div>;
    }
    return this.props.children;
  }
}
```

## Monitoring Setup

### 1. Health Checks

```javascript
// Create monitoring endpoint
// /api/health/route.ts
export async function GET() {
  const checks = {
    database: await testDatabase(),
    openrouter: await testOpenRouter(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  };
  
  const isHealthy = checks.database && checks.openrouter;
  
  return Response.json(checks, { 
    status: isHealthy ? 200 : 503 
  });
}
```

### 2. Performance Monitoring

```javascript
// Track performance metrics
const trackPerformance = (name, fn) => {
  return async (...args) => {
    const start = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      
      console.log(`[PERF] ${name}: ${duration}ms`);
      
      // Send to analytics
      if (typeof gtag !== 'undefined') {
        gtag('event', 'performance_timing', {
          name,
          duration
        });
      }
      
      return result;
    } catch (error) {
      console.error(`[PERF ERROR] ${name}:`, error);
      throw error;
    }
  };
};

// Usage
const trackedSaveMessages = trackPerformance('saveMessages', saveMessages);
```

### 3. User Feedback Collection

```javascript
// Add feedback widget
const FeedbackButton = () => {
  const handleFeedback = () => {
    const feedback = prompt('Having issues? Describe what happened:');
    if (feedback) {
      fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });
    }
  };
  
  return (
    <button onClick={handleFeedback} className="text-xs text-gray-500">
      Report Issue
    </button>
  );
};
```

## Recovery Procedures

### 1. Database Recovery

```bash
# Backup current state
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Reset tables (DANGER: Will lose data)
psql $DATABASE_URL << EOF
DROP TABLE IF EXISTS chat_summaries;
DROP TABLE IF EXISTS chat_sessions;
EOF

# Restore from backup
psql $DATABASE_URL < backup_file.sql

# Or rerun migrations
npm run db:migrate
```

### 2. Environment Recovery

```bash
# Backup current env
cp .env.local .env.local.backup

# Reset to defaults
cp .env.example .env.local

# Restore from backup
cp .env.local.backup .env.local
```

### 3. Cache Clearing

```bash
# Clear all caches
rm -rf .next
rm -rf node_modules/.cache
npm cache clean --force

# Clear browser cache
# DevTools → Application → Storage → Clear storage
```

## Getting Help

### 1. Self-Service Resources

- **Logs**: Check browser console and network tab
- **Environment**: Run `npm run check-env`
- **Database**: Test `/api/database-test`
- **Documentation**: Check `docs/` folder

### 2. Debug Information to Collect

When seeking help, include:

```bash
# System info
echo "OS: $(uname -a)"
echo "Node: $(node --version)" 
echo "NPM: $(npm --version)"

# Project info
echo "Package: $(grep '"name"' package.json)"
echo "Build: $(npm run build 2>&1 | tail -5)"

# Environment status
npm run check-env

# Recent logs
tail -20 ~/.npm/_logs/$(ls -t ~/.npm/_logs/ | head -1)
```

### 3. Common Support Channels

- **GitHub Issues**: For bugs and feature requests
- **Discord/Slack**: For real-time help
- **Stack Overflow**: For technical questions (tag: `nextjs`, `supabase`, `openrouter`)

---

## Prevention Tips

1. **Regular Health Checks**: Set up automated monitoring
2. **Environment Validation**: Always run `npm run check-env` after changes
3. **Backup Strategy**: Regular database and environment backups
4. **Version Control**: Commit working states frequently
5. **Testing**: Test in preview environment before production deployment

Remember: When in doubt, check the logs first! 🦆🔍 