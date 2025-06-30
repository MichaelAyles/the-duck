import type { NextConfig } from "next";

/**
 * 🦆 The Duck - Next.js Configuration
 * 
 * Optimized configuration for development and production environments
 */
const nextConfig: NextConfig = {
  // 🚀 Performance optimizations
  experimental: {
    // Enable modern bundling optimizations for key libraries
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-icons',
      'react-markdown',
      'remark-gfm'
    ],
    // Enable webpack build worker for faster builds
    webpackBuildWorker: true,
  },

  // 📦 Build optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 🗜️ Basic compression
  compress: true,
  
  // 🛡️ Security headers
  async headers() {
    const securityHeaders = [
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
    ];

    // Add HSTS in production
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      });
    }

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/api/(.*)',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        // Cache static assets
        source: '/(_next/static|favicon.ico|icon.svg)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // 🌐 Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // 🔄 Simple redirect
  async redirects() {
    return [
      {
        source: '/chat',
        destination: '/',
        permanent: false,
      },
    ];
  },

  // 🔒 Type checking and linting
  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: true, // Ignore linting during builds for deployment
  },

  // SWC minification is enabled by default in Next.js 13+
  
  // 🔧 Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Suppress the annoying Supabase realtime warnings
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Critical dependency: the request of a dependency is an expression/,
    ];
    return config;
  },

  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    productionBrowserSourceMaps: false,
    // Font optimization is enabled by default in Next.js 15
  }),
};

export default nextConfig;
