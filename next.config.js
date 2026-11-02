/** @type {import('next').NextConfig} */
const nextConfig = {
 basePath: '/admin',
 // assetPrefix: '/admin',
  reactStrictMode: true,
  // Ignore warnings from jsonwebtoken (Node.js APIs not available in Edge)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
  // Force dynamic rendering for pages that use client-side hooks
  staticPageGenerationTimeout: 120,
};

module.exports = nextConfig;
