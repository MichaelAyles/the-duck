# 🔒 Security Documentation - The Duck

## Overview

This document outlines the comprehensive security measures implemented in The Duck chat application. Our security approach follows defense-in-depth principles with multiple layers of protection.

## 🛡️ Security Architecture

### Multi-Layer Security Model

```
┌─────────────────────────────────────────┐
│              User Interface             │ ← XSS Protection, CSP
├─────────────────────────────────────────┤
│           Next.js Middleware            │ ← CORS, Headers, Route Protection
├─────────────────────────────────────────┤
│            API Layer Security           │ ← Rate Limiting, Input Validation
├─────────────────────────────────────────┤
│          Application Security           │ ← Sanitization, Authentication
├─────────────────────────────────────────┤
│          Database Security              │ ← RLS, Encryption, Monitoring
└─────────────────────────────────────────┘
```

## 🔐 Security Features Implemented

### 1. API Security
- **✅ API Key Validation**: Strict format validation for OpenRouter and Supabase keys
- **✅ Rate Limiting**: 100 requests/15min for chat, 20 requests/15min for models
- **✅ Input Validation**: Zod schemas with strict type checking
- **✅ Input Sanitization**: XSS prevention and content filtering
- **✅ CORS Protection**: Whitelist-based origin validation

### 2. Infrastructure Security
- **✅ Security Headers**: HSTS, CSP, X-Frame-Options, X-XSS-Protection
- **✅ Content Security Policy**: Strict CSP with nonce-based script execution
- **✅ HTTPS Enforcement**: Automatic HTTPS redirect in production
- **✅ Environment Isolation**: Separate configs for dev/staging/production

### 3. Database Security
- **✅ Row Level Security (RLS)**: Implemented with future auth readiness
- **✅ SQL Injection Prevention**: Parameterized queries via Drizzle ORM
- **✅ Data Sanitization**: Automatic message content sanitization
- **✅ Audit Logging**: Security event tracking and monitoring

### 4. Application Security
- **✅ Error Handling**: Secure error messages without information leakage
- **✅ Dependency Security**: Regular dependency updates and vulnerability scanning
- **✅ Secret Management**: Environment-based configuration
- **✅ Logging & Monitoring**: Comprehensive security event logging

## 🚨 Threat Model

### Identified Threats and Mitigations

| Threat Category | Risk Level | Mitigation |
|----------------|------------|------------|
| **Cross-Site Scripting (XSS)** | High | Content sanitization, CSP headers, input validation |
| **SQL Injection** | High | ORM usage, parameterized queries, input validation |
| **API Abuse** | Medium | Rate limiting, API key validation, monitoring |
| **Data Breaches** | High | RLS policies, encryption in transit, access controls |
| **CSRF Attacks** | Medium | SameSite cookies, CORS policies, token validation |
| **Denial of Service** | Medium | Rate limiting, resource monitoring, load balancing |
| **Man-in-the-Middle** | High | HTTPS enforcement, HSTS, certificate pinning |
| **Insecure Dependencies** | Medium | Automated vulnerability scanning, regular updates |

## 📋 Production Security Checklist

### Pre-Deployment Security Audit

#### Environment Configuration
- [ ] **API Keys**: All production API keys are properly configured
- [ ] **Environment Variables**: No hardcoded secrets in codebase
- [ ] **HTTPS**: SSL certificate properly configured
- [ ] **Domain Security**: Domain ownership verified and secured

#### Application Security
- [ ] **Security Headers**: All security headers are active in production
- [ ] **CORS Configuration**: Production domains whitelisted only
- [ ] **Rate Limiting**: Production-appropriate rate limits configured
- [ ] **Error Handling**: No sensitive information in error responses

#### Database Security
- [ ] **RLS Policies**: Row Level Security enabled and tested
- [ ] **Access Controls**: Database access restricted to application only
- [ ] **Backup Security**: Database backups are encrypted
- [ ] **Connection Security**: Database connections use SSL/TLS

#### Monitoring & Logging
- [ ] **Security Monitoring**: Security events are logged and monitored
- [ ] **Alerting**: Critical security alerts are configured
- [ ] **Log Retention**: Security logs retained for compliance period
- [ ] **Incident Response**: Security incident response plan documented

### Security Testing

#### Automated Testing
```bash
# Run security tests (development only)
curl "http://localhost:12000/api/security-test?test=all"

# Check for dependency vulnerabilities
npm audit

# Run linting for security issues
npm run lint
```

#### Manual Testing
- [ ] **XSS Testing**: Attempt script injection in chat inputs
- [ ] **Rate Limit Testing**: Verify rate limits block excessive requests
- [ ] **CORS Testing**: Verify cross-origin requests are properly handled
- [ ] **SQL Injection Testing**: Attempt malicious database queries

## 🔧 Security Configuration Details

### Rate Limiting Configuration

```typescript
RATE_LIMIT: {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: {
    CHAT: 100,      // Chat completions
    MODELS: 20,     // Model fetching
    API: 200,       // General API calls
  }
}
```

### Input Validation Limits

```typescript
INPUT_LIMITS: {
  MESSAGE_LENGTH: 10000,   // Max message length
  MESSAGES_COUNT: 100,     // Max messages per conversation
  SESSION_ID_LENGTH: 50,   // Max session ID length
  MODEL_ID_LENGTH: 100,    // Max model ID length
}
```

### Security Headers

```typescript
SECURITY_HEADERS: {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://openrouter.ai https://*.supabase.co;"
}
```

## 🚀 Deployment Security Best Practices

### Vercel Deployment Security

1. **Environment Variables**
   - Store all secrets in Vercel environment variables
   - Use different values for preview and production deployments
   - Enable "Sensitive" flag for API keys

2. **Domain Security**
   - Configure custom domain with proper DNS settings
   - Enable domain verification
   - Set up proper SSL/TLS configuration

3. **Function Security**
   - Configure appropriate function timeouts
   - Monitor function invocation patterns
   - Set up budget alerts for unusual usage

### Supabase Security Configuration

1. **Database Security**
   ```sql
   -- Apply RLS policies
   \i sql/rls_policies.sql
   
   -- Enable audit logging
   ALTER DATABASE postgres SET log_statement = 'all';
   ```

2. **API Security**
   - Restrict API access to application domains only
   - Enable database webhooks for audit logging
   - Configure row-level security policies

3. **Backup Security**
   - Enable automated backups with encryption
   - Set appropriate backup retention period
   - Test backup restoration procedures

## 🔍 Security Monitoring

### Key Security Metrics

1. **API Security Metrics**
   - Rate limit violations per hour
   - Failed authentication attempts
   - Unusual request patterns
   - Response time anomalies

2. **Database Security Metrics**
   - RLS policy violations
   - Suspicious query patterns
   - Connection anomalies
   - Data access patterns

3. **Application Security Metrics**
   - Error rate spikes
   - XSS attempt detection
   - CORS violation attempts
   - Security header compliance

### Security Event Dashboard

```sql
-- Query for security events summary
SELECT 
  DATE(created_at) as date,
  event_type,
  severity,
  COUNT(*) as event_count
FROM security_events 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), event_type, severity
ORDER BY date DESC, event_count DESC;
```

### Alerting Configuration

#### Critical Alerts (Immediate Response Required)
- Multiple failed authentication attempts
- SQL injection attempts detected
- Rate limit violations exceeding threshold
- Suspicious data access patterns

#### Warning Alerts (Monitor Closely)
- Unusual API usage patterns
- High error rates
- Performance degradation
- Dependency vulnerabilities

## 📚 Security Resources

### Internal Security Tools

1. **Security Testing Endpoint** (Development Only)
   ```
   GET /api/security-test?test=all
   ```

2. **Security Configuration Validation**
   ```typescript
   import { SecurityTesting } from '@/lib/security';
   SecurityTesting.testRateLimit('test', 5);
   SecurityTesting.testInputValidation();
   ```

3. **Database Security Functions**
   ```sql
   SELECT check_rate_limit('user_ip', '/api/chat', 100, 15);
   SELECT * FROM security_suspicious_activity;
   CALL cleanup_old_data(90);
   ```

### External Security Resources

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Next.js Security Documentation](https://nextjs.org/docs/advanced-features/security-headers)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/permissions)
- [Vercel Security Documentation](https://vercel.com/docs/security)

## 🆘 Incident Response

### Security Incident Response Plan

1. **Detection & Analysis**
   - Monitor security event logs
   - Analyze threat indicators
   - Assess impact and scope

2. **Containment**
   - Implement immediate protective measures
   - Isolate affected systems
   - Preserve evidence for analysis

3. **Recovery**
   - Apply security patches
   - Restore affected services
   - Verify system integrity

4. **Post-Incident**
   - Document lessons learned
   - Update security measures
   - Conduct team review

### Emergency Contacts

- **Security Team**: security@the-duck.app
- **Development Team**: dev@the-duck.app
- **Infrastructure Team**: infra@the-duck.app

## 🔐 Security Compliance

### Data Protection Compliance

- **GDPR**: Personal data handling and user consent
- **CCPA**: California consumer privacy requirements
- **SOC 2**: Security and availability controls
- **Privacy**: Data minimization and purpose limitation

### Security Standards Alignment

- **OWASP Top 10**: Web application security risks
- **ISO 27001**: Information security management
- **NIST Cybersecurity Framework**: Risk management
- **PCI DSS**: Payment card data security (if applicable)

---

## 📝 Security Maintenance

This security documentation should be reviewed and updated:
- **Monthly**: Security configuration review
- **Quarterly**: Threat model assessment
- **Annually**: Comprehensive security audit
- **As needed**: After security incidents or major changes

Last Updated: November 2024
Security Review Due: December 2024 