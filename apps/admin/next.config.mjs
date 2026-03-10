/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  output: 'standalone',
  distDir: isDev ? '.next-dev' : '.next',
  async rewrites() {
    const internalApiBaseUrl = process.env.INTERNAL_API_BASE_URL ?? 'http://127.0.0.1:30011';

    return [
      { source: '/branding/:path*', destination: `${internalApiBaseUrl}/branding/:path*` },
    ];
  },
};

export default nextConfig;
