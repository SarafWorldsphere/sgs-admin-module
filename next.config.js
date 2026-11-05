/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/admin',
  reactStrictMode: true,
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
  staticPageGenerationTimeout: 120,
};

module.exports = nextConfig;