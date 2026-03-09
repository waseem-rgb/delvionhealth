/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@delvion/ui", "@delvion/types"],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "node_modules/@swc/**",
        "node_modules/@esbuild/**",
      ],
    },
  },
};

export default nextConfig;
