import type { NextConfig } from "next";

/**
 * 🦆 The Duck - Next.js Configuration
 * 
 * Optimized configuration for development and production environments
 */
const nextConfig: NextConfig = {
  // 🚀 Performance optimizations
  experimental: {
    // Enable modern bundling optimizations
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // 🔧 Development configuration
  ...(process.env.NODE_ENV === 'development' && {
    // Enhanced logging for development
    logging: {
      fetches: {
        fullUrl: true,
      },
    },
  }),

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
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
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
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' 
              ? 'http://localhost:12000' 
              : 'https://the-duck.vercel.app',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
          },
        ],
      },
    ];
  },

  // 🌐 Image optimization
  images: {
    domains: [
      'images.unsplash.com',
      'avatars.githubusercontent.com',
    ],
    formats: ['image/webp', 'image/avif'],
  },

  // 📦 Bundle analyzer (enable with ANALYZE=true)
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config: any) => {
      config.plugins.push(
        new (require('@next/bundle-analyzer')({
          enabled: true,
        }))()
      );
      return config;
    },
  }),

  // 🔄 Redirects for better UX
  async redirects() {
    return [
      {
        source: '/chat',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
