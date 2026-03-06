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
};

export default nextConfig;
