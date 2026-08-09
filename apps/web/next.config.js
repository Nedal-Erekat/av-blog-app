const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@av-blog/shared'],
  cacheComponents: true,
  async rewrites() {
    // Proxies browser requests to the API through this app's own origin, so the
    // auth cookie (set on the proxied response) is first-party to this domain
    // instead of the API's — needed because web (Vercel) and API (Render) are
    // different domains in production, which otherwise breaks both `cookies()`
    // reads on the server and the browser sending the cookie back at all.
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

module.exports = nextConfig;
