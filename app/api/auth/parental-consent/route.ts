import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const ParentalConsentSchema = z.object({
  childName: z.string().min(1).max(100),
  childEmail: z.string().email(),
  parentEmail: z.string().email(),
  birthYear: z.number().int().min(2006).max(2026),
  inviteCode: z.string().max(20).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ParentalConsentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { childName, childEmail, parentEmail, birthYear, inviteCode } = parsed.data;

  // Create a pending consent record in Firestore. The consentId is used as a
  // token in the parent verification link — no separate signed token needed.
  const consentRef = adminDb.collection("parentalConsents").doc();
  const consentId = consentRef.id;

  await consentRef.set({
    childName,
    childEmail,
    parentEmail,
    birthYear,
    ...(inviteCode ? { inviteCode } : {}),
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://skolnieks.ai";
  const verifyUrl = `${baseUrl}/parental-verify?token=${consentId}`;

  const emailSubject = "Vecāku atļauja — SkolnieksAI reģistrācija";

  const emailBody = `
Labdien,

Jūsu bērns ${childName} (dzimšanas gads: ${birthYear}) vēlas reģistrēties SkolnieksAI — mācību palīglīdzeklī Latvijas skolu skolēniem.

Par SkolnieksAI:
SkolnieksAI ir mākslīgā intelekta balstīts mācību asistents, kas palīdz Latvijas skolēniem saprast mācību vielu latviešu valodā. Platforma ir balstīta uz Latvijas mācību programmu (Skola2030) un nodrošina drošu, izglītojošu saturu.

Datu aizsardzība:
• Visi lietotāja dati tiek glabāti ES serverī (Firebase europe-west1)
• Dati tiek izmantoti tikai izglītojošiem nolūkiem
• Nekāda uzvedības profilēšana vai reklāmas nepilngadīgajiem
• Atbilstoši Latvijas PDPL un ES GDPR prasībām

Lai apstiprinātu jūsu bērna reģistrāciju, noklikšķiniet uz šīs saites:
${verifyUrl}

Verifikācijai tiek izmantots €0.01 maksājums, kas tiek nekavējoties atmaksāts. Tas ļauj mums pārbaudīt, ka piekrišanu sniedz īsts pieaugušais (GDPR 8. panta prasība).

Ja neesat pieprasījuši šo reģistrāciju, vienkārši ignorējiet šo e-pastu.

Ar cieņu,
SkolnieksAI komanda
https://skolnieks.ai
`.trim();

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[parental-consent] RESEND_API_KEY is not set");
    return NextResponse.json({ error: "email_unavailable" }, { status: 503 });
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: "SkolnieksAI <noreply@skolnieksai.lv>",
    to: parentEmail,
    subject: emailSubject,
    text: emailBody,
  });

  if (error) {
    console.error("[parental-consent] Failed to send email to", parentEmail, error);
    // Clean up the orphaned consent record
    await consentRef.delete();
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
