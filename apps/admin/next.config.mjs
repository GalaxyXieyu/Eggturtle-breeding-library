/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  output: 'standalone',
  distDir: isDev ? '.next-dev' : '.next',
  async rewrites() {
    const internalApiBaseUrl = process.env.INTERNAL_API_BASE_URL ?? 'http://127.0.0.1:30011';

    return [
      { source: '/api/auth/:path*', destination: `${internalApiBaseUrl}/auth/:path*` },
      { source: '/api/proxy/:path*', destination: `${internalApiBaseUrl}/:path*` },
      { source: '/branding/:path*', destination: `${internalApiBaseUrl}/branding/:path*` },
    ];
  },
};

export default nextConfig;
