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

// CSP for all HTML routes.
// 'nonce-PLACEHOLDER' is replaced at request time by middleware with a real nonce.
// 'strict-dynamic' trusts scripts loaded by a nonced script, so dynamically injected
// sub-resources from Firebase Auth no longer need individual origin allowlist entries.
// apis.google.com/js/api.js and gstatic.com/firebasejs/ are kept as allowlist fallbacks
// for browsers that don't support 'strict-dynamic', scoped to minimum required paths
// rather than the full origins (which host JSONP/Angular bypass vectors).
const csp = [
  "default-src 'self'",
  [
    "script-src",
    "'self'",
    "'nonce-PLACEHOLDER'",
    "'strict-dynamic'",
    // Minimum required paths — full-origin allowlist removed to prevent JSONP/Angular bypasses
    "https://apis.google.com/js/api.js",
    "https://www.gstatic.com/firebasejs/",
  ].join(" "),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  [
    "connect-src",
    "'self'",
    "https://firebase.googleapis.com",
    "https://firebaseinstallations.googleapis.com",
    "https://*.googleapis.com",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://region2.google-analytics.com",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://api.stripe.com",
  ].join(" "),
  "frame-src https://accounts.google.com https://*.firebaseapp.com https://js.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
]
  .join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["chromadb", "@xenova/transformers"],

  async headers() {
    return [
      // All routes: full security header set including CSP
      {
        source: "/(.*)",
        headers: [
          ...commonSecurityHeaders,
          { key: "Content-Security-Policy", value: csp },
        ],
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
