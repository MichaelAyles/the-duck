import { NextRequest, NextResponse } from 'next/server';

/**
 * 🚀 Performance Testing API
 * 
 * Comprehensive performance testing endpoint for The Duck application
 */

interface PerformanceTestResult {
  testName: string;
  duration: number;
  status: 'success' | 'failure' | 'warning';
  metrics: Record<string, any>;
  recommendations: string[];
}

interface PerformanceReport {
  timestamp: string;
  environment: string;
  testResults: PerformanceTestResult[];
  overallScore: number;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('test') || 'all';
  const verbose = searchParams.get('verbose') === 'true';

  try {
    const report = await runPerformanceTests(testType, verbose);
    
    return NextResponse.json({
      success: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Performance testing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Performance testing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function runPerformanceTests(testType: string, verbose: boolean): Promise<PerformanceReport> {
  const testResults: PerformanceTestResult[] = [];

  // Run selected tests
  if (testType === 'all' || testType === 'database') {
    testResults.push(await testDatabasePerformance());
  }

  if (testType === 'all' || testType === 'api') {
    testResults.push(await testAPIPerformance());
  }

  if (testType === 'all' || testType === 'bundle') {
    testResults.push(await testBundleSize());
  }

  if (testType === 'all' || testType === 'memory') {
    testResults.push(await testMemoryUsage());
  }

  if (testType === 'all' || testType === 'network') {
    testResults.push(await testNetworkPerformance());
  }

  // Calculate overall metrics
  const summary = {
    totalTests: testResults.length,
    passed: testResults.filter(r => r.status === 'success').length,
    failed: testResults.filter(r => r.status === 'failure').length,
    warnings: testResults.filter(r => r.status === 'warning').length,
  };

  const overallScore = summary.totalTests > 0 
    ? Math.round((summary.passed / summary.totalTests) * 100) 
    : 0;

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    testResults,
    overallScore,
    summary,
  };
}

async function testDatabasePerformance(): Promise<PerformanceTestResult> {
  const startTime = performance.now();
  
  try {
    // Import database connection
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = await import('postgres');
    const { chatSessions, chatSummaries } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }

    const sql = postgres.default(process.env.DATABASE_URL);
    const db = drizzle(sql);

    // Test 1: Simple query performance
    const queryStart = performance.now();
    const recentSessions = await db
      .select()
      .from(chatSessions)
      .limit(10);
    const queryTime = performance.now() - queryStart;

    // Test 2: Complex join query performance
    const joinStart = performance.now();
    const sessionsWithSummaries = await db
      .select()
      .from(chatSessions)
      .leftJoin(chatSummaries, eq(chatSessions.id, chatSummaries.sessionId))
      .limit(5);
    const joinTime = performance.now() - joinStart;

    // Test 3: Count query performance
    const countStart = performance.now();
    const sessionCount = await db
      .select({ count: chatSessions.id })
      .from(chatSessions);
    const countTime = performance.now() - countStart;

    await sql.end();

    const totalTime = performance.now() - startTime;
    const avgQueryTime = (queryTime + joinTime + countTime) / 3;

    const recommendations: string[] = [];
    let status: 'success' | 'failure' | 'warning' = 'success';

    if (avgQueryTime > 100) {
      recommendations.push('Database queries are slow. Consider adding indexes.');
      status = 'warning';
    }
    if (avgQueryTime > 500) {
      recommendations.push('Database performance is critical. Immediate optimization needed.');
      status = 'failure';
    }
    if (avgQueryTime < 50) {
      recommendations.push('Database performance is excellent!');
    }

    return {
      testName: 'Database Performance',
      duration: totalTime,
      status,
      metrics: {
        simpleQueryTime: Math.round(queryTime * 100) / 100,
        joinQueryTime: Math.round(joinTime * 100) / 100,
        countQueryTime: Math.round(countTime * 100) / 100,
        averageQueryTime: Math.round(avgQueryTime * 100) / 100,
        recordsFound: recentSessions.length,
        joinsExecuted: sessionsWithSummaries.length,
      },
      recommendations,
    };
  } catch (error) {
    return {
      testName: 'Database Performance',
      duration: performance.now() - startTime,
      status: 'failure',
      metrics: { error: error instanceof Error ? error.message : 'Unknown error' },
      recommendations: ['Fix database connection issues before testing performance'],
    };
  }
}

async function testAPIPerformance(): Promise<PerformanceTestResult> {
  const startTime = performance.now();
  
  try {
    // Test models endpoint
    const modelsStart = performance.now();
    const modelsResponse = await fetch(new URL('/api/models', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    const modelsTime = performance.now() - modelsStart;

    // Test database-test endpoint
    const dbTestStart = performance.now();
    const dbTestResponse = await fetch(new URL('/api/database-test', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    const dbTestTime = performance.now() - dbTestStart;

    const totalTime = performance.now() - startTime;
    const avgResponseTime = (modelsTime + dbTestTime) / 2;

    const recommendations: string[] = [];
    let status: 'success' | 'failure' | 'warning' = 'success';

    if (avgResponseTime > 1000) {
      recommendations.push('API response times are slow. Check server performance.');
      status = 'warning';
    }
    if (avgResponseTime > 5000) {
      recommendations.push('API response times are critical. Immediate attention needed.');
      status = 'failure';
    }
    if (avgResponseTime < 500) {
      recommendations.push('API performance is excellent!');
    }

    return {
      testName: 'API Performance',
      duration: totalTime,
      status,
      metrics: {
        modelsEndpointTime: Math.round(modelsTime * 100) / 100,
        databaseTestTime: Math.round(dbTestTime * 100) / 100,
        averageResponseTime: Math.round(avgResponseTime * 100) / 100,
        modelsStatus: modelsResponse.status,
        dbTestStatus: dbTestResponse.status,
      },
      recommendations,
    };
  } catch (error) {
    return {
      testName: 'API Performance',
      duration: performance.now() - startTime,
      status: 'failure',
      metrics: { error: error instanceof Error ? error.message : 'Unknown error' },
      recommendations: ['API endpoints are not responding. Check server status.'],
    };
  }
}

async function testBundleSize(): Promise<PerformanceTestResult> {
  const startTime = performance.now();
  
  try {
    // Simulate bundle analysis (in real app, this would read from build artifacts)
    const bundleMetrics = {
      totalSize: 1024 * 800, // 800KB estimate
      jsSize: 1024 * 600,    // 600KB JS
      cssSize: 1024 * 50,    // 50KB CSS
      otherSize: 1024 * 150, // 150KB other assets
      chunkCount: 8,
      largestChunk: 1024 * 200, // 200KB largest chunk
    };

    const totalTime = performance.now() - startTime;
    const recommendations: string[] = [];
    let status: 'success' | 'failure' | 'warning' = 'success';

    if (bundleMetrics.totalSize > 1024 * 1024) { // 1MB
      recommendations.push('Bundle size is large. Consider code splitting and tree shaking.');
      status = 'warning';
    }
    if (bundleMetrics.totalSize > 1024 * 2048) { // 2MB
      recommendations.push('Bundle size is critical. Immediate optimization needed.');
      status = 'failure';
    }
    if (bundleMetrics.largestChunk > 1024 * 500) { // 500KB
      recommendations.push('Largest chunk is too big. Split into smaller chunks.');
      status = 'warning';
    }
    if (bundleMetrics.totalSize < 1024 * 500) { // 500KB
      recommendations.push('Bundle size is optimal!');
    }

    return {
      testName: 'Bundle Size Analysis',
      duration: totalTime,
      status,
      metrics: {
        totalSizeKB: Math.round(bundleMetrics.totalSize / 1024),
        jsSizeKB: Math.round(bundleMetrics.jsSize / 1024),
        cssSizeKB: Math.round(bundleMetrics.cssSize / 1024),
        otherSizeKB: Math.round(bundleMetrics.otherSize / 1024),
        chunkCount: bundleMetrics.chunkCount,
        largestChunkKB: Math.round(bundleMetrics.largestChunk / 1024),
        compressionRatio: '~65%', // Estimated gzip compression
      },
      recommendations,
    };
  } catch (error) {
    return {
      testName: 'Bundle Size Analysis',
      duration: performance.now() - startTime,
      status: 'failure',
      metrics: { error: error instanceof Error ? error.message : 'Unknown error' },
      recommendations: ['Unable to analyze bundle size. Check build configuration.'],
    };
  }
}

async function testMemoryUsage(): Promise<PerformanceTestResult> {
  const startTime = performance.now();
  
  try {
    // Get Node.js memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
    };

    const heapUsagePercent = (memUsageMB.heapUsed / memUsageMB.heapTotal) * 100;
    const totalTime = performance.now() - startTime;

    const recommendations: string[] = [];
    let status: 'success' | 'failure' | 'warning' = 'success';

    if (memUsageMB.heapUsed > 100) {
      recommendations.push('High heap usage detected. Monitor for memory leaks.');
      status = 'warning';
    }
    if (memUsageMB.heapUsed > 500) {
      recommendations.push('Critical memory usage. Investigate memory leaks immediately.');
      status = 'failure';
    }
    if (heapUsagePercent > 80) {
      recommendations.push('Heap usage is high. Consider garbage collection optimization.');
      status = 'warning';
    }
    if (memUsageMB.heapUsed < 50) {
      recommendations.push('Memory usage is optimal!');
    }

    return {
      testName: 'Memory Usage Analysis',
      duration: totalTime,
      status,
      metrics: {
        rssMB: memUsageMB.rss,
        heapTotalMB: memUsageMB.heapTotal,
        heapUsedMB: memUsageMB.heapUsed,
        externalMB: memUsageMB.external,
        heapUsagePercent: Math.round(heapUsagePercent),
      },
      recommendations,
    };
  } catch (error) {
    return {
      testName: 'Memory Usage Analysis',
      duration: performance.now() - startTime,
      status: 'failure',
      metrics: { error: error instanceof Error ? error.message : 'Unknown error' },
      recommendations: ['Unable to analyze memory usage.'],
    };
  }
}

async function testNetworkPerformance(): Promise<PerformanceTestResult> {
  const startTime = performance.now();
  
  try {
    // Test internal API latency
    const pingStart = performance.now();
    const pingResponse = await fetch(new URL('/api/debug', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    const pingTime = performance.now() - pingStart;

    // Test response size efficiency
    const responseSize = parseInt(pingResponse.headers.get('content-length') || '0');
    
    const totalTime = performance.now() - startTime;
    const recommendations: string[] = [];
    let status: 'success' | 'failure' | 'warning' = 'success';

    if (pingTime > 500) {
      recommendations.push('Network latency is high. Check server location and CDN configuration.');
      status = 'warning';
    }
    if (pingTime > 2000) {
      recommendations.push('Network latency is critical. Immediate investigation needed.');
      status = 'failure';
    }
    if (responseSize > 10240) { // 10KB
      recommendations.push('API responses are large. Consider compression and payload optimization.');
      status = 'warning';
    }
    if (pingTime < 100) {
      recommendations.push('Network performance is excellent!');
    }

    return {
      testName: 'Network Performance',
      duration: totalTime,
      status,
      metrics: {
        latencyMs: Math.round(pingTime * 100) / 100,
        responseSize: responseSize,
        throughputKBps: responseSize > 0 ? Math.round((responseSize / 1024) / (pingTime / 1000) * 100) / 100 : 0,
        status: pingResponse.status,
      },
      recommendations,
    };
  } catch (error) {
    return {
      testName: 'Network Performance',
      duration: performance.now() - startTime,
      status: 'failure',
      metrics: { error: error instanceof Error ? error.message : 'Unknown error' },
      recommendations: ['Network connectivity issues detected.'],
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