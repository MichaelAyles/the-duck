// TypeScript import for React
import React from 'react';

/**
 * 🚀 Performance Monitoring & Optimization Utilities
 * 
 * Essential performance tracking and optimization tools for The Duck
 */

// Performance Metrics Interface
export interface PerformanceMetrics {
  renderTime: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  memoryUsage?: {
    used: number;
    total: number;
    limit: number;
  };
}

// Basic Performance Monitor
class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    // Only observe essential Web Vitals in browser
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        // First Contentful Paint (FCP)
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.firstContentfulPaint = entry.startTime;
            }
          });
        });
        observer.observe({ type: 'paint', buffered: true });
      } catch (error) {
        // Silently fail if performance observation is not supported
      }
    }
  }

  // Get memory usage (Chrome only)
  getMemoryUsage() {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      };
    }
  }

  // Get current metrics
  getMetrics(): Partial<PerformanceMetrics> {
    this.getMemoryUsage();
    return { ...this.metrics };
  }

  // Reset metrics
  reset() {
    this.metrics = {};
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React Performance Hooks
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = React.useState<Partial<PerformanceMetrics>>({});

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics());
    }, 2000); // Update every 2 seconds (less frequent)

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

// Component render time tracking
export function useRenderTimer(componentName: string) {
  const renderStartTime = React.useRef<number>(0);
  const [renderTime, setRenderTime] = React.useState<number>(0);

  React.useLayoutEffect(() => {
    renderStartTime.current = performance.now();
  });

  React.useEffect(() => {
    if (renderStartTime.current) {
      const duration = performance.now() - renderStartTime.current;
      setRenderTime(duration);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 ${componentName} render time: ${duration.toFixed(2)}ms`);
      }
    }
  });

  return renderTime;
}

// Bundle size analysis
export function getBundleMetrics() {
  if (typeof window === 'undefined') return null;

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  
  const jsResources = resources.filter(resource => 
    resource.name.includes('.js') && 
    (resource.name.includes('_next') || resource.name.includes('static'))
  );

  const cssResources = resources.filter(resource => 
    resource.name.includes('.css')
  );

  const totalJSSize = jsResources.reduce((total, resource) => total + (resource.transferSize || 0), 0);
  const totalCSSSize = cssResources.reduce((total, resource) => total + (resource.transferSize || 0), 0);

  return {
    javascript: {
      count: jsResources.length,
      totalSize: totalJSSize,
      resources: jsResources.map(r => ({
        name: r.name.split('/').pop() || r.name,
        size: r.transferSize || 0,
        duration: r.duration,
      })),
    },
    css: {
      count: cssResources.length,
      totalSize: totalCSSSize,
      resources: cssResources.map(r => ({
        name: r.name.split('/').pop() || r.name,
        size: r.transferSize || 0,
        duration: r.duration,
      })),
    },
    total: totalJSSize + totalCSSSize,
  };
}

// Performance optimization utilities
export const PerformanceUtils = {
  // Debounce function calls
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate = false
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func(...args);
    };
  },

  // Throttle function calls
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // Lazy load images
  lazyLoadImage(src: string, placeholder?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  },

  // Intersection Observer for lazy loading
  createIntersectionObserver(
    callback: (entries: IntersectionObserverEntry[]) => void,
    options?: IntersectionObserverInit
  ): IntersectionObserver | null {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return null;
    }

    return new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options,
    });
  },

  // Measure function execution time
  measureExecutionTime<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚡ ${name} execution time: ${(end - start).toFixed(2)}ms`);
    }
    
    return result;
  },

  // Virtual scrolling helper
  calculateVisibleItems(
    containerHeight: number,
    itemHeight: number,
    scrollTop: number,
    totalItems: number,
    overscan = 5
  ) {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2);
    
    return { startIndex, endIndex, visibleCount };
  },
};

// Performance reporting
export class PerformanceReporter {
  private static instance: PerformanceReporter;
  private reportEndpoint = '/api/performance';

  static getInstance(): PerformanceReporter {
    if (!PerformanceReporter.instance) {
      PerformanceReporter.instance = new PerformanceReporter();
    }
    return PerformanceReporter.instance;
  }

  async reportMetrics(metrics: Partial<PerformanceMetrics>, context?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') return;

    try {
      await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics,
          context,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      });
    } catch (error) {
      console.warn('Failed to report performance metrics:', error);
    }
  }

  generateReport(): PerformanceReport {
    const metrics = performanceMonitor.getMetrics();
    const bundleMetrics = getBundleMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      metrics,
      bundleMetrics,
      recommendations: this.generateRecommendations(metrics, bundleMetrics),
    };
  }

  private generateRecommendations(
    metrics: Partial<PerformanceMetrics>,
    bundleMetrics: any
  ): string[] {
    const recommendations: string[] = [];

    // LCP recommendations
    if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > 2500) {
      recommendations.push('⚠️ Largest Contentful Paint is slow. Consider optimizing images and reducing bundle size.');
    }

    // Bundle size recommendations
    if (bundleMetrics && bundleMetrics.total > 1024 * 1024) { // 1MB
      recommendations.push('📦 Bundle size is large. Consider dynamic imports and tree shaking.');
    }

    // Memory recommendations
    if (metrics.memoryUsage) {
      const memoryUsagePercent = (metrics.memoryUsage.used / metrics.memoryUsage.limit) * 100;
      if (memoryUsagePercent > 80) {
        recommendations.push('🧠 Memory usage is high. Check for memory leaks and optimize component re-renders.');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Performance looks good! Keep up the excellent work.');
    }

    return recommendations;
  }
}

export interface PerformanceReport {
  timestamp: string;
  metrics: Partial<PerformanceMetrics>;
  bundleMetrics: any;
  recommendations: string[];
}

// Simple memoization hooks
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return React.useCallback(callback, deps) as T;
}

export function useMemoizedValue<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return React.useMemo(factory, deps);
}

// Performance testing utilities
export const PerformanceTesting = {
  // Stress test component rendering
  async stressTestRender(
    component: React.ComponentType<any>,
    iterations = 100
  ): Promise<{ avgRenderTime: number; maxRenderTime: number; minRenderTime: number }> {
    const renderTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      // Simulate component render
      React.createElement(component);
      const end = performance.now();
      renderTimes.push(end - start);
    }

    return {
      avgRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      minRenderTime: Math.min(...renderTimes),
    };
  },

  // Test bundle loading performance
  async testBundleLoading(): Promise<number> {
    const start = performance.now();
    
    // Simulate dynamic import
    await import('react');
    
    return performance.now() - start;
  },

  // Network performance test
  async testNetworkPerformance(url: string): Promise<{
    requestTime: number;
    responseSize: number;
    success: boolean;
  }> {
    const start = performance.now();
    
    try {
      const response = await fetch(url);
      const responseSize = parseInt(response.headers.get('content-length') || '0');
      
      return {
        requestTime: performance.now() - start,
        responseSize,
        success: response.ok,
      };
    } catch (error) {
      return {
        requestTime: performance.now() - start,
        responseSize: 0,
        success: false,
      };
    }
  },
};

// Auto-start performance monitoring in browser
if (typeof window !== 'undefined') {
  // Report metrics after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      const reporter = PerformanceReporter.getInstance();
      const report = reporter.generateReport();
      
      if (process.env.NODE_ENV === 'development') {
        console.group('🚀 Performance Report');
        console.table(report.metrics);
        console.log('📦 Bundle Metrics:', report.bundleMetrics);
        console.log('💡 Recommendations:', report.recommendations);
        console.groupEnd();
      }
    }, 2000); // Wait 2s for metrics to settle
  });
} 