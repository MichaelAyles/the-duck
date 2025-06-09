# The Duck Deployment Guide 🦆

## Overview

This guide covers deploying The Duck to production using Vercel (frontend) and Supabase (database). The application is designed for seamless deployment with minimal configuration.

## Prerequisites

- Node.js 18+ installed locally
- Git repository with The Duck code
- Vercel account (free tier available)
- Supabase account (free tier available)
- OpenRouter account for AI models

## Quick Start

### 1. Supabase Setup (5 minutes)

#### Create Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose organization and enter project details:
   - **Name**: `the-duck` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users

#### Configure Database
1. Wait for project initialization (2-3 minutes)
2. Go to **Settings** → **Database**
3. Copy the connection details:
   - **URL**: `https://xxx.supabase.co`
   - **Anon Key**: `eyJhbGciOi...`
   - **Service Role Key**: `eyJhbGciOi...` (keep secret!)

#### Run Migrations
1. Go to **SQL Editor** in Supabase dashboard
2. Create a new query and paste the contents of `drizzle/0000_flippant_korg.sql`
3. Run the migration
4. Optionally run `drizzle/0001_enhanced_production.sql` for optimizations

### 2. OpenRouter Setup (2 minutes)

1. Go to [openrouter.ai](https://openrouter.ai) and sign in
2. Navigate to **API Keys**
3. Create new API key:
   - **Name**: `the-duck-production`
   - **Limit**: Set appropriate spending limits
4. Copy the API key: `sk_or_...`

### 3. Vercel Deployment (3 minutes)

#### Connect Repository
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your Git repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

#### Set Environment Variables
In Vercel project settings, add these environment variables:

```bash
# OpenRouter API
OPENROUTER_API_KEY=sk_or_your_api_key_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
DATABASE_URL=postgresql://postgres:your_password@db.xxx.supabase.co:5432/postgres

# Application URL (will be provided after first deployment)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

#### Deploy
1. Click "Deploy"
2. Wait for build completion (2-3 minutes)
3. Your app will be live at `https://your-app.vercel.app`

## Detailed Setup

### Supabase Advanced Configuration

#### Row Level Security (RLS)
Enable RLS for production security:

```sql
-- Enable RLS on tables
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies (when auth is added)
CREATE POLICY "Users can view own sessions" ON chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### Database Optimizations
```sql
-- Add indexes for performance
CREATE INDEX CONCURRENTLY idx_chat_sessions_user_created 
    ON chat_sessions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_chat_summaries_session_topics 
    ON chat_summaries USING GIN(topics);

-- Analyze tables for query planning
ANALYZE chat_sessions;
ANALYZE chat_summaries;
```

#### Backup Configuration
1. Go to **Settings** → **Database**
2. Enable **Point-in-time Recovery**
3. Set backup retention: 7 days (free) or 30 days (pro)

### Vercel Advanced Configuration

#### Custom Domain Setup
1. In Vercel project settings, go to **Domains**
2. Add your custom domain: `chat.yourdomain.com`
3. Configure DNS records as instructed
4. SSL certificate will be auto-generated

#### Environment Variables by Environment
```bash
# Production
NEXT_PUBLIC_APP_URL=https://chat.yourdomain.com
NODE_ENV=production

# Preview (for pull requests)
NEXT_PUBLIC_APP_URL=https://the-duck-git-main.vercel.app
NODE_ENV=preview

# Development
NEXT_PUBLIC_APP_URL=http://localhost:12000
NODE_ENV=development
```

#### Performance Optimizations
Add to `vercel.json`:
```json
{
  "functions": {
    "src/app/api/chat/route.ts": {
      "maxDuration": 30
    },
    "src/app/api/summarize/route.ts": {
      "maxDuration": 15
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## Monitoring & Analytics

### Vercel Analytics
```typescript
// Add to src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Error Tracking with Sentry
```bash
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### Database Monitoring
1. Go to Supabase **Logs** tab
2. Monitor slow queries and errors
3. Set up alerts for high error rates

## CI/CD Pipeline

### GitHub Actions
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Type check
        run: npm run type-check
        
      - name: Lint
        run: npm run lint
        
      - name: Build
        run: npm run build
        
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## Security Checklist

### Pre-Production
- [ ] Environment variables properly set
- [ ] API keys rotated and secured
- [ ] Database backups enabled
- [ ] HTTPS enforced
- [ ] RLS policies configured
- [ ] CORS properly configured
- [ ] Rate limiting implemented

### Production Hardening
```typescript
// next.config.ts security headers
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload'
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];
```

## Performance Optimization

### Bundle Analysis
```bash
# Install analyzer
npm install @next/bundle-analyzer

# Analyze bundle
ANALYZE=true npm run build
```

### Database Performance
```sql
-- Monitor slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename IN ('chat_sessions', 'chat_summaries');
```

### CDN Configuration
- Static assets automatically cached by Vercel
- API responses cached appropriately
- Images optimized with Next.js Image component

## Scaling Considerations

### Database Scaling
- **Free Tier**: 500MB storage, 2 CPU hours
- **Pro Tier**: 8GB storage, unlimited CPU
- **Team Tier**: 100GB storage, dedicated resources

### Function Scaling
- **Hobby**: 100GB-hours/month
- **Pro**: 1000GB-hours/month
- **Team**: Unlimited with higher limits

### Rate Limiting
```typescript
// Implement rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
```

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check for TypeScript errors
npm run type-check

# Check for lint errors
npm run lint

# Verify environment variables
npm run check-env
```

#### Database Connection Issues
```bash
# Test database connectivity
curl https://your-app.vercel.app/api/database-test

# Check Supabase logs
# Go to Supabase Dashboard → Logs
```

#### Performance Issues
```bash
# Monitor function execution time
# Go to Vercel Dashboard → Functions tab

# Check database performance
# Go to Supabase Dashboard → Reports
```

### Debug Mode
Enable debug mode in production:
```bash
NEXT_PUBLIC_DEBUG=true
```

### Log Analysis
```typescript
// Structured logging in production
console.log(JSON.stringify({
  level: 'info',
  message: 'Chat session created',
  sessionId,
  timestamp: new Date().toISOString(),
  metadata: { model, messageCount }
}));
```

## Backup & Recovery

### Database Backups
1. **Automatic**: Enabled by default in Supabase
2. **Manual**: Export from Supabase dashboard
3. **Migration**: Use `pg_dump` for full exports

### Code Backups
1. **Git**: Primary source control
2. **Vercel**: Automatic deployments preserved
3. **Local**: Regular local backups recommended

### Recovery Procedures
1. **Database**: Point-in-time recovery via Supabase
2. **Code**: Rollback via Git + Vercel
3. **Environment**: Backup environment variables securely

## Cost Estimation

### Monthly Costs (USD)

#### Minimal Usage
- **Vercel Hobby**: $0 (up to 100GB-hours)
- **Supabase Free**: $0 (up to 500MB storage)
- **OpenRouter**: $5-20 (depending on usage)
- **Total**: $5-20/month

#### Medium Usage
- **Vercel Pro**: $20 (1000GB-hours)
- **Supabase Pro**: $25 (8GB storage)
- **OpenRouter**: $50-100
- **Total**: $95-145/month

#### High Usage
- **Vercel Team**: $50
- **Supabase Team**: $100
- **OpenRouter**: $200-500
- **Total**: $350-650/month

## Support & Maintenance

### Monitoring Schedule
- **Daily**: Check error rates and performance
- **Weekly**: Review usage and costs
- **Monthly**: Update dependencies and security patches

### Update Procedures
1. Test updates in preview environment
2. Run full test suite
3. Deploy during low-traffic hours
4. Monitor for 24 hours post-deployment

### Emergency Contacts
- **Vercel Support**: Available for Pro+ plans
- **Supabase Support**: Available for paid plans
- **OpenRouter Support**: Via Discord/email

---

## Quick Reference

### Essential URLs
- **App**: https://your-app.vercel.app
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com
- **OpenRouter Dashboard**: https://openrouter.ai/keys

### Essential Commands
```bash
# Deploy manually
vercel --prod

# Check logs
vercel logs

# Run database migrations
npm run db:migrate

# Test production build locally
npm run build && npm start
```

Happy deploying! 🚀🦆 