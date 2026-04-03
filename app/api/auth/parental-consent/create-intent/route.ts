import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe/client";
import { adminDb } from "@/lib/firebase/admin";

const Schema = z.object({ consentId: z.string().min(1) });

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const { consentId } = parsed.data;

  const consentDoc = await adminDb.collection("parentalConsents").doc(consentId).get();
  if (!consentDoc.exists) {
    return NextResponse.json({ error: "consent_not_found" }, { status: 404 });
  }

  const consent = consentDoc.data() as { status: string; childName: string; parentEmail: string };
  if (consent.status !== "pending") {
    return NextResponse.json({ error: "consent_already_processed" }, { status: 409 });
  }

  let clientSecret: string | null;
  try {
    const pi = await stripe.paymentIntents.create({
      amount: 1, // €0.01 — minimum chargeable amount; refunded immediately on success
      currency: "eur",
      receipt_email: consent.parentEmail,
      metadata: { consentId, childName: consent.childName },
      description: `SkolnieksAI vecāku verifikācija — ${consent.childName}`,
    });
    clientSecret = pi.client_secret;
  } catch (err) {
    console.error("[parental-consent/create-intent] Stripe error:", err);
    return NextResponse.json({ error: "stripe_error" }, { status: 502 });
  }

  return NextResponse.json({ clientSecret });
}
