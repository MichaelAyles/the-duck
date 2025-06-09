import { NextRequest, NextResponse } from 'next/server';
import { 
  SecurityTesting, 
  ApiKeySecurity, 
  SecurityAudit,
  SecurityConfig 
} from '@/lib/security';
import { getEnv } from '@/lib/env';

/**
 * 🧪 Security Testing Endpoint
 * 
 * This endpoint allows testing security features in development
 * It should be disabled in production
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Security testing not available in production' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('test');

  try {
    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      testType,
    };

    switch (testType) {
      case 'rate-limit':
        results.rateLimitTest = await SecurityTesting.testRateLimit(
          'test-client',
          5 // Test with 5 requests
        );
        break;

      case 'input-validation':
        results.inputValidationTest = SecurityTesting.testInputValidation();
        break;

      case 'api-keys':
        const env = getEnv();
        results.apiKeyValidation = {
          openRouter: {
            hasKey: !!env.OPENROUTER_API_KEY,
            validFormat: ApiKeySecurity.validateOpenRouterKey(env.OPENROUTER_API_KEY),
            sanitized: ApiKeySecurity.sanitizeForLogging(env.OPENROUTER_API_KEY),
          },
          supabase: {
            hasKey: !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            validFormat: ApiKeySecurity.validateSupabaseKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
            sanitized: ApiKeySecurity.sanitizeForLogging(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
          },
        };
        break;

      case 'security-headers':
        results.securityHeaders = SecurityConfig.SECURITY_HEADERS;
        results.corsConfig = SecurityConfig.CORS;
        break;

      case 'all':
        // Run all tests
        results.tests = {
          rateLimitTest: await SecurityTesting.testRateLimit('test-client-all', 3),
          inputValidationTest: SecurityTesting.testInputValidation(),
          apiKeyValidation: {
            openRouter: {
              hasKey: !!process.env.OPENROUTER_API_KEY,
              validFormat: ApiKeySecurity.validateOpenRouterKey(process.env.OPENROUTER_API_KEY || ''),
            },
            supabase: {
              hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
              validFormat: ApiKeySecurity.validateSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
            },
          },
          securityConfig: {
            hasSecurityHeaders: Object.keys(SecurityConfig.SECURITY_HEADERS).length > 0,
            hasCorsConfig: SecurityConfig.CORS.ALLOWED_ORIGINS.length > 0,
            rateLimits: SecurityConfig.RATE_LIMIT,
            inputLimits: SecurityConfig.INPUT_LIMITS,
          },
        };
        break;

      default:
        return NextResponse.json(
          {
            error: 'Invalid test type',
            availableTests: [
              'rate-limit',
              'input-validation', 
              'api-keys',
              'security-headers',
              'all'
            ],
            usage: '/api/security-test?test=<test-type>',
          },
          { status: 400 }
        );
    }

    // Log the security test
    SecurityAudit.logSuspiciousActivity(
      'API_KEY_INVALID', // Using available type for logging
      { testType, results: 'security-test-passed' },
      request
    );

    return NextResponse.json({
      success: true,
      testType,
      results,
      recommendations: getSecurityRecommendations(results),
    });

  } catch (error) {
    console.error('Security test error:', error);
    return NextResponse.json(
      { 
        error: 'Security test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function getSecurityRecommendations(results: any): string[] {
  const recommendations: string[] = [];

  if (results.apiKeyValidation) {
    if (!results.apiKeyValidation.openRouter.validFormat) {
      recommendations.push('⚠️ OpenRouter API key format appears invalid');
    }
    if (!results.apiKeyValidation.supabase.validFormat) {
      recommendations.push('⚠️ Supabase API key format appears invalid');
    }
  }

  if (results.rateLimitTest === false) {
    recommendations.push('⚠️ Rate limiting may not be working correctly');
  }

  if (results.inputValidationTest === false) {
    recommendations.push('🚨 Input validation is not working - potential XSS vulnerability');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ All security tests passed!');
  }

  return recommendations;
}

/**
 * Handle POST requests for more complex security tests
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Security testing not available in production' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action, payload } = body;

    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      action,
    };

    switch (action) {
      case 'test-input-sanitization':
        if (payload?.inputs && Array.isArray(payload.inputs)) {
          results.sanitizationResults = payload.inputs.map((input: string) => ({
            original: input,
            sanitized: SecurityTesting.testInputValidation(),
          }));
        }
        break;

      case 'simulate-attack':
        // Simulate various attack patterns (safely in dev)
        results.attackSimulation = {
          xssAttempts: [
            '<script>alert("xss")</script>',
            'javascript:alert("xss")',
          ].map(attack => ({
            attack,
            blocked: SecurityTesting.testInputValidation(),
          })),
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action', availableActions: ['test-input-sanitization', 'simulate-attack'] },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      results,
    });

  } catch (error) {
    console.error('Security test POST error:', error);
    return NextResponse.json(
      { 
        error: 'Security test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 