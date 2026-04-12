import type { NextConfig } from "next";
import path from "path";

// Headers applied to every route (main pages, API routes, etc.)
const commonSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "0" }, // Disable legacy XSS auditor; rely on CSP
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["chromadb"],

  async headers() {
    return [
      // All routes: non-CSP security headers.
      // CSP is set per-request by middleware.ts (needs a fresh nonce each time).
      {
        source: "/(.*)",
        headers: [...commonSecurityHeaders],
      },
      // Static assets: explicit security + long-lived cache headers
      // (/_next/static/* was previously missing these entirely)
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
