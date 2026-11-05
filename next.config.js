/** @type {import('next').NextConfig} */
const nextConfig = {
  // assetPrefix, not basePath. The pages live at app/admin/*, so they already
  // serve at /admin/... — basePath adds the prefix a second time and Next then
  // looks for app/students, which does not exist. That is why /admin/students
  // returned 404 while the redirect itself was correct.
  //
  // This was assetPrefix until 4 Nov, when it was changed while fixing a
  // timetable build error.
  assetPrefix: '/admin',
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