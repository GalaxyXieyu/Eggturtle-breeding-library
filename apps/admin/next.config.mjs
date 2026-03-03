/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  output: 'standalone',
  distDir: isDev ? '.next-dev' : '.next'
};

export default nextConfig;
