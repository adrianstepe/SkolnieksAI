import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { stripe } from "@/lib/stripe/client";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const Schema = z.object({
  consentId: z.string().min(1),
  paymentIntentId: z.string().min(1),
});

type ConsentRecord = {
  childName: string;
  childEmail: string;
  parentEmail: string;
  birthYear: number;
  inviteCode?: string;
  status: string;
};

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

  const { consentId, paymentIntentId } = parsed.data;

  // Load and validate the consent record
  const consentRef = adminDb.collection("parentalConsents").doc(consentId);
  const consentDoc = await consentRef.get();
  if (!consentDoc.exists) {
    return NextResponse.json({ error: "consent_not_found" }, { status: 404 });
  }

  const consent = consentDoc.data() as ConsentRecord;
  if (consent.status !== "pending") {
    return NextResponse.json({ error: "already_processed" }, { status: 409 });
  }

  // Verify the Stripe PaymentIntent status and that it belongs to this consent
  let pi: Awaited<ReturnType<typeof stripe.paymentIntents.retrieve>>;
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    console.error("[parental-consent/verify] Failed to retrieve PaymentIntent:", err);
    return NextResponse.json({ error: "stripe_error" }, { status: 502 });
  }

  if (pi.status !== "succeeded") {
    return NextResponse.json({ error: "payment_not_succeeded" }, { status: 400 });
  }

  // Guard: ensure the PaymentIntent was created for this exact consentId
  if (pi.metadata.consentId !== consentId) {
    console.error("[parental-consent/verify] PaymentIntent/consent mismatch", {
      piConsentId: pi.metadata.consentId,
      consentId,
    });
    return NextResponse.json({ error: "payment_mismatch" }, { status: 400 });
  }

  // Create the child's Firebase Auth account (no password — child sets it via email link)
  let firebaseUid: string;
  try {
    const userRecord = await adminAuth.createUser({
      email: consent.childEmail,
      displayName: consent.childName,
      emailVerified: false,
    });
    firebaseUid = userRecord.uid;
  } catch (err) {
    console.error("[parental-consent/verify] Failed to create Firebase user:", err);
    return NextResponse.json({ error: "user_creation_failed" }, { status: 500 });
  }

  // Create the Firestore user profile
  await adminDb.collection("users").doc(firebaseUid).set({
    email: consent.childEmail,
    displayName: consent.childName,
    birthYear: consent.birthYear,
    parentConsent: true,
    parentEmail: consent.parentEmail,
    stripePaymentIntentId: paymentIntentId,
    plan: "free",
    ...(consent.inviteCode ? { inviteCode: consent.inviteCode } : {}),
    createdAt: FieldValue.serverTimestamp(),
  });

  // Mark consent as verified
  await consentRef.update({
    status: "verified",
    firebaseUid,
    stripePaymentIntentId: paymentIntentId,
    verifiedAt: FieldValue.serverTimestamp(),
  });

  // Refund the €0.01 — non-fatal if this fails (account already created)
  try {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
  } catch (err) {
    // Log and continue — the refund can be retried manually from the Stripe dashboard
    console.error("[parental-consent/verify] Refund failed for PI", paymentIntentId, err);
  }

  // Send a password-setup email to the child so they can log in
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resetLink = await adminAuth.generatePasswordResetLink(consent.childEmail);
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "SkolnieksAI <noreply@send.skolnieksai.lv>",
        to: consent.childEmail,
        subject: "SkolnieksAI — iestati savu paroli un sāc mācīties!",
        text: `Sveiki, ${consent.childName}!

Tavs vecāks ir apstiprinājis tavu reģistrāciju SkolnieksAI. Tagad tev jāiestata parole, lai varētu pieteikties.

Noklikšķini uz šīs saites, lai iestatītu savu paroli:
${resetLink}

Saite ir derīga 1 stundu.

Ar cieņu,
SkolnieksAI komanda
https://skolnieks.ai`.trim(),
      });
    } catch (err) {
      // Non-fatal — the account exists; child can use "Aizmirsi paroli?" to set a password
      console.error("[parental-consent/verify] Failed to send password-setup email:", err);
    }
  }

  // TODO: Implement eParaksts / Smart-ID verification as an alternative path
  // (post-launch). These are Latvia's national eID systems and would allow
  // identity verification without a card payment. Integration requires registration
  // with the relevant trust service provider (e.g. Dokobit, Smart-ID Enterprise).

  return NextResponse.json({ success: true });
}
