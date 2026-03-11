/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@delvion/ui", "@delvion/types"],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: process.env.MINIO_PUBLIC_HOST ?? "minio.delvionhealth.com",
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
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@swc/**",
      "node_modules/@esbuild/**",
    ],
  },
};

export default nextConfig;
