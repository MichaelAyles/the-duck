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
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
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
