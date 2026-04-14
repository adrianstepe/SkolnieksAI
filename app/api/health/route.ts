import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Booleans only — never expose key values or partial strings.
function configured(key: string): boolean {
  return !!process.env[key];
}

export async function GET() {
  const rateLimitEnabled = configured("REDIS_URL");

  const services = {
    rateLimit: rateLimitEnabled ? "enabled" : "disabled (fail-open)",
    firebase: configured("FIREBASE_SERVICE_ACCOUNT_KEY") ? "configured" : "missing",
    deepseek: configured("DEEPSEEK_API_KEY") ? "configured" : "missing",
    anthropic: configured("ANTHROPIC_API_KEY") ? "configured" : "missing",
    stripe: configured("STRIPE_SECRET_KEY") ? "configured" : "missing",
    chroma: configured("CHROMA_API_KEY") ? "configured" : "missing",
    resend: configured("RESEND_API_KEY") ? "configured" : "missing",
  };

  const allCritical =
    services.firebase === "configured" &&
    services.deepseek === "configured" &&
    services.stripe === "configured" &&
    services.chroma === "configured";

  return NextResponse.json(
    {
      status: allCritical ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services,
    },
    { status: allCritical ? 200 : 503 }
  );
}
