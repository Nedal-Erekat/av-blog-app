/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@av-blog/shared'],
  cacheComponents: true,
};

module.exports = nextConfig;
