import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /** Giảm kích thước bundle icon Lucide khi import nhiều symbol */
    optimizePackageImports: ["lucide-react"],
  },
  async redirects() {
    return [
      { source: "/dashboard/seo_tools", destination: "/dashboard/seo-tools", permanent: false },
      { source: "/dashboard/seo_tools/:path*", destination: "/dashboard/seo-tools/:path*", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
