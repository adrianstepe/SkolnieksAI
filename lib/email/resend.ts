import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Client — lazily validated so missing keys surface at call-time, not build time.
// ---------------------------------------------------------------------------

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY environment variable is not set");
  return new Resend(key);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreakReminderPayload {
  to: string;
  displayName: string | null;
  currentStreak: number;
}

// ---------------------------------------------------------------------------
// Email template (Latvian, plain HTML — no external template engine needed)
// ---------------------------------------------------------------------------

function buildStreakReminderHtml(
  displayName: string | null,
  currentStreak: number,
): string {
  const name = displayName ?? "Student";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://skolnieks.ai";

  return `<!DOCTYPE html>
<html lang="lv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tava sērija ir apdraudēta</title>
  <style>
    body { margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .header { background: #1d1d1f; padding: 28px 32px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: -0.3px; }
    .body { padding: 32px; }
    .streak-badge { display: inline-block; background: #fff3cd; color: #92400e; font-size: 28px; font-weight: 700; padding: 12px 20px; border-radius: 8px; margin-bottom: 24px; }
    .body p { margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6; }
    .cta { display: inline-block; margin-top: 8px; padding: 13px 28px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; }
    .footer { padding: 20px 32px; border-top: 1px solid #f3f4f6; }
    .footer p { margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>SkolnieksAI</h1>
    </div>
    <div class="body">
      <div class="streak-badge">${currentStreak} dienu sērija</div>
      <p>Sveiks, ${name}!</p>
      <p>
        Tava <strong>${currentStreak} dienu mācību sērija</strong> beigsies pēc pusnakts,
        ja šodien vēl neesi pieteicies.
      </p>
      <p>
        Viens īss jautājums ir pietiekami — piesakies un turpini no tur, kur apstājies.
      </p>
      <a href="${appUrl}" class="cta">Turpināt mācīties</a>
    </div>
    <div class="footer">
      <p>
        Tu saņem šo e-pastu, jo tev ir aktīva mācību sērija SkolnieksAI.<br />
        Ja nevēlies saņemt atgādinājumus, vari tos izslēgt iestatījumos.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public send function
// ---------------------------------------------------------------------------

/**
 * Sends a streak reminder email to a single user.
 * Returns true on success, false on any Resend error (caller decides how to handle).
 */
export async function sendStreakReminderEmail(
  payload: StreakReminderPayload,
): Promise<boolean> {
  const resend = getResendClient();
  const { to, displayName, currentStreak } = payload;

  const { error } = await resend.emails.send({
    from: "SkolnieksAI <atgadinajumi@skolnieks.ai>",
    to,
    subject: `Tava ${currentStreak} dienu sērija ir apdraudēta`,
    html: buildStreakReminderHtml(displayName, currentStreak),
  });

  if (error) {
    console.error(`[streak-reminder] Failed to send to ${to}:`, error);
    return false;
  }

  return true;
}
