/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const internalApiBaseUrl = process.env.INTERNAL_API_BASE_URL ?? 'http://127.0.0.1:30011';

    return [
      { source: '/health', destination: `${internalApiBaseUrl}/health` },
      { source: '/health/db', destination: `${internalApiBaseUrl}/health/db` },

      // Allow nested paths like /me/subscription.
      { source: '/me/:path*', destination: `${internalApiBaseUrl}/me/:path*` },
      { source: '/me', destination: `${internalApiBaseUrl}/me` },

      { source: '/auth/:path*', destination: `${internalApiBaseUrl}/auth/:path*` },
      { source: '/tenants/:path*', destination: `${internalApiBaseUrl}/tenants/:path*` },
      { source: '/products/:path*', destination: `${internalApiBaseUrl}/products/:path*` },
      { source: '/series/:path*', destination: `${internalApiBaseUrl}/series/:path*` },
      { source: '/breeders/:path*', destination: `${internalApiBaseUrl}/breeders/:path*` },
      { source: '/featured-products/:path*', destination: `${internalApiBaseUrl}/featured-products/:path*` },
      { source: '/ai-assistant/:path*', destination: `${internalApiBaseUrl}/ai-assistant/:path*` },
      { source: '/tenant-share-presentation/:path*', destination: `${internalApiBaseUrl}/tenant-share-presentation/:path*` },
      { source: '/shares/:path*', destination: `${internalApiBaseUrl}/shares/:path*` },
      { source: '/s/:path*', destination: `${internalApiBaseUrl}/s/:path*` },
      { source: '/subscriptions/:path*', destination: `${internalApiBaseUrl}/subscriptions/:path*` },
      { source: '/payments/:path*', destination: `${internalApiBaseUrl}/payments/:path*` },
      { source: '/audit-logs/:path*', destination: `${internalApiBaseUrl}/audit-logs/:path*` },
      { source: '/admin/:path*', destination: `${internalApiBaseUrl}/admin/:path*` }
    ];
  }
};

export default nextConfig;
