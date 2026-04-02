import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const ParentalConsentSchema = z.object({
  childName: z.string().min(1).max(100),
  parentEmail: z.string().email(),
  birthYear: z.number().int().min(2006).max(2026),
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

  const { childName, parentEmail, birthYear } = parsed.data;

  // Stub confirmation URL — replace PLACEHOLDER with a signed token when the
  // full parental-consent confirmation flow is implemented.
  const confirmUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://skolnieks.ai"}/api/auth/parental-consent/confirm?token=PLACEHOLDER`;

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
${confirmUrl}

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
    from: "SkolnieksAI <noreply@send.skolnieksai.lv>",
    to: parentEmail,
    subject: emailSubject,
    text: emailBody,
  });

  if (error) {
    console.error("[parental-consent] Failed to send email to", parentEmail, error);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
