import { NextRequest, NextResponse } from 'next/server';

/**
 * 🚀 Performance Test API Route
 * 
 * Tests various performance aspects of The Duck application
 * including API response times, memory usage, and system health
 */

interface PerformanceTestResult {
  name: string;
  duration: number;
  status: 'success' | 'failure' | 'warning';
  details: Record<string, any>;
  recommendations: string[];
}

export async function GET() {
  const startTime = performance.now();
  const results: PerformanceTestResult[] = [];

  try {
    // Test 1: OpenRouter API Performance
    results.push(await testOpenRouterPerformance());

    // Test 2: Supabase Performance
    results.push(await testSupabasePerformance());

    // Test 3: Memory Usage
    results.push(await testMemoryUsage());

    // Test 4: Environment Configuration
    results.push(await testEnvironmentConfig());

    const totalTime = performance.now() - startTime;
    
    // Calculate overall health score
    const successCount = results.filter(r => r.status === 'success').length;
    const healthScore = Math.round((successCount / results.length) * 100);
    
    return NextResponse.json({
      status: 'success',
      message: 'Performance test completed',
      data: {
        totalDuration: Math.round(totalTime),
        healthScore,
        results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          warning: results.filter(r => r.status === 'warning').length,
          failure: results.filter(r => r.status === 'failure').length,
        },
        recommendations: results.flatMap(r => r.recommendations),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Performance test error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Performance test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

async function testOpenRouterPerformance(): Promise<PerformanceTestResult> {
  const startTime = performance.now();
  
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return {
        name: 'OpenRouter API Performance',
        duration: 0,
        status: 'warning',
        details: { configured: false },
        recommendations: ['Configure OPENROUTER_API_KEY to test API performance'],
      };
    }

    // Test API connectivity
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const duration = performance.now() - startTime;
    
    if (!response.ok) {
      return {
        name: 'OpenRouter API Performance',
        duration: Math.round(duration),
        status: 'failure',
        details: { 
          status: response.status,
          statusText: response.statusText,
        },
        recommendations: ['Check OpenRouter API key validity', 'Verify network connectivity'],
      };
    }

    const data = await response.json();
    const modelCount = data.data?.length || 0;
    
    const recommendations: string[] = [];
    let status: 'success' | 'failure' | 'warning' = 'success';

    if (duration > 2000) {
      recommendations.push('OpenRouter API response is slow. Check network connectivity.');
      status = 'warning';
    }
    if (duration > 5000) {
      recommendations.push('OpenRouter API response is very slow. Consider using a different network.');
      status = 'failure';
    }
    if (modelCount < 10) {
      recommendations.push('Limited models available. Verify API key permissions.');
    }

    return {
      name: 'OpenRouter API Performance',
      duration: Math.round(duration),
      status,
      details: {
        responseTime: Math.round(duration),
        modelsAvailable: modelCount,
        configured: true,
      },
      recommendations,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    
    return {
      name: 'OpenRouter API Performance',
      duration: Math.round(duration),
      status: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        configured: !!process.env.OPENROUTER_API_KEY,
      },
      recommendations: [
        'Check internet connectivity',
        'Verify OpenRouter API key is valid',
        'Check firewall settings',
      ],
    };
  }
}

async function testSupabasePerformance(): Promise<PerformanceTestResult> {
  const startTime = performance.now();
  
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return {
        name: 'Supabase Performance',
        duration: 0,
        status: 'warning',
        details: { configured: false },
        recommendations: ['Configure Supabase environment variables to test database performance'],
      };
    }

    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Test simple query
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id')
      .limit(1);

    const duration = performance.now() - startTime;
    
    if (error) {
      return {
        name: 'Supabase Performance',
        duration: Math.round(duration),
        status: 'failure',
        details: {
          error: error.message,
          configured: true,
        },
        recommendations: [
          'Check Supabase project status',
          'Verify database tables exist',
          'Check RLS policies',
        ],
      };
    }

    const recommendations: string[] = [];
    let status: 'success' | 'failure' | 'warning' = 'success';

    if (duration > 1000) {
      recommendations.push('Supabase queries are slow. Check database performance.');
      status = 'warning';
    }
    if (duration > 3000) {
      recommendations.push('Supabase queries are very slow. Consider database optimization.');
      status = 'failure';
    }

    return {
      name: 'Supabase Performance',
      duration: Math.round(duration),
      status,
      details: {
        responseTime: Math.round(duration),
        querySuccessful: true,
        configured: true,
      },
      recommendations,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    
    return {
      name: 'Supabase Performance',
      duration: Math.round(duration),
      status: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        configured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      },
      recommendations: [
        'Check Supabase configuration',
        'Verify network connectivity',
        'Check Supabase project status',
      ],
    };
  }
}

async function testMemoryUsage(): Promise<PerformanceTestResult> {
  const startTime = performance.now();
  
  try {
    const memoryUsage = process.memoryUsage();
    const duration = performance.now() - startTime;
    
    // Convert bytes to MB
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
    
    const recommendations: string[] = [];
    let status: 'success' | 'failure' | 'warning' = 'success';
    
    if (heapUsedMB > 100) {
      recommendations.push('High memory usage detected. Consider optimizing memory usage.');
      status = 'warning';
    }
    if (heapUsedMB > 200) {
      recommendations.push('Very high memory usage. Immediate optimization needed.');
      status = 'failure';
    }
    
    return {
      name: 'Memory Usage',
      duration: Math.round(duration),
      status,
      details: {
        heapUsedMB,
        heapTotalMB,
        rssMB,
        heapUsagePercent: Math.round((heapUsedMB / heapTotalMB) * 100),
      },
      recommendations,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    
    return {
      name: 'Memory Usage',
      duration: Math.round(duration),
      status: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      recommendations: ['Unable to measure memory usage'],
    };
  }
}

async function testEnvironmentConfig(): Promise<PerformanceTestResult> {
  const startTime = performance.now();
  
  try {
    const requiredVars = [
      'OPENROUTER_API_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ];
    
    const optionalVars = [
      'NEXT_PUBLIC_APP_URL',
    ];
    
    const missingRequired = requiredVars.filter(varName => !process.env[varName]);
    const missingOptional = optionalVars.filter(varName => !process.env[varName]);
    
    const duration = performance.now() - startTime;
    
    const recommendations: string[] = [];
    let status: 'success' | 'failure' | 'warning' = 'success';
    
    if (missingRequired.length > 0) {
      recommendations.push(`Missing required environment variables: ${missingRequired.join(', ')}`);
      status = 'failure';
    }
    
    if (missingOptional.length > 0) {
      recommendations.push(`Missing optional environment variables: ${missingOptional.join(', ')}`);
      if (status === 'success') status = 'warning';
    }
    
    return {
      name: 'Environment Configuration',
      duration: Math.round(duration),
      status,
      details: {
        requiredVarsCount: requiredVars.length,
        requiredVarsPresent: requiredVars.length - missingRequired.length,
        optionalVarsCount: optionalVars.length,
        optionalVarsPresent: optionalVars.length - missingOptional.length,
        missingRequired,
        missingOptional,
      },
      recommendations,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    
    return {
      name: 'Environment Configuration',
      duration: Math.round(duration),
      status: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      recommendations: ['Unable to check environment configuration'],
    };
  }
}

// POST endpoint for stress testing
export async function POST(request: NextRequest) {
  try {
    const { testType, iterations = 10, concurrency = 1 } = await request.json();

    const results = await runStressTest(testType, iterations, concurrency);
    
    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stress testing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Stress testing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function runStressTest(testType: string, iterations: number, concurrency: number) {
  const results = {
    testType,
    iterations,
    concurrency,
    startTime: Date.now(),
    endTime: 0,
    totalDuration: 0,
    averageResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    successCount: 0,
    errorCount: 0,
    throughput: 0,
  };

  const promises: Promise<number>[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const promise = (async () => {
      const start = performance.now();
      try {
        const response = await fetch(new URL('/api/models', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
        if (response.ok) {
          results.successCount++;
        } else {
          results.errorCount++;
        }
        return performance.now() - start;
      } catch (error) {
        results.errorCount++;
        return performance.now() - start;
      }
    })();
    
    promises.push(promise);
    
    // Control concurrency
    if (promises.length >= concurrency) {
      const responseTimes = await Promise.all(promises);
      responseTimes.forEach(time => {
        results.minResponseTime = Math.min(results.minResponseTime, time);
        results.maxResponseTime = Math.max(results.maxResponseTime, time);
      });
      promises.length = 0;
    }
  }

  // Handle remaining promises
  if (promises.length > 0) {
    const responseTimes = await Promise.all(promises);
    responseTimes.forEach(time => {
      results.minResponseTime = Math.min(results.minResponseTime, time);
      results.maxResponseTime = Math.max(results.maxResponseTime, time);
    });
  }

  results.endTime = Date.now();
  results.totalDuration = results.endTime - results.startTime;
  results.averageResponseTime = (results.minResponseTime + results.maxResponseTime) / 2;
  results.throughput = (results.successCount / (results.totalDuration / 1000));

  return results;
} 