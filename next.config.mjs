/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['postgres', 'bcryptjs'],
  },
  webpack: (config, { nextRuntime }) => {
    // The edge instrumentation bundle follows the node-only dynamic import.
    // postgres and bcryptjs use Node builtins the edge compile cannot resolve.
    // Edge register() returns before that import runs.
    if (nextRuntime === 'edge') {
      config.resolve.alias = {
        ...config.resolve.alias,
        postgres: false,
        bcryptjs: false,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.tiktokcdn.com' },
      { protocol: 'https', hostname: '**.tiktokcdn-us.com' },
      { protocol: 'https', hostname: '**.tiktokcdn-eu.com' },
      { protocol: 'https', hostname: '**.ytimg.com' },
    ],
  },
};

export default nextConfig;
