import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: Next.js blocks cross-origin requests to dev-server assets (HMR,
  // /_next/*) from any host other than localhost. When the app is reached via
  // the EC2 box's public IP, that triggers the cross-origin/CORS block — so the
  // host is allowlisted here. Host only: no protocol, no port. Has no effect on
  // a production build (`next start`).
  allowedDevOrigins: ['13.48.196.130'],
};

export default nextConfig;
