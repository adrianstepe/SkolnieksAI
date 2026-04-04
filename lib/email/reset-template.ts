import { Resend } from "resend";

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY environment variable is not set");
  return new Resend(key);
}

function buildResetEmailHtml(resetUrl: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://skolnieksai.lv";

  return `<!DOCTYPE html>
<html lang="lv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Paroles atiestatīšana</title>
  <style>
    body { margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .header { background: #1d1d1f; padding: 28px 32px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: -0.3px; }
    .body { padding: 32px; }
    .body p { margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; }
    .warning p { margin: 0; color: #92400e; font-size: 14px; font-weight: 600; }
    .cta { display: inline-block; margin-top: 8px; padding: 13px 28px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; }
    .url-fallback { margin-top: 24px; padding-top: 16px; border-top: 1px solid #f3f4f6; }
    .url-fallback p { font-size: 12px; color: #9ca3af; word-break: break-all; }
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
      <p>Sveiks!</p>
      <p>Mēs saņēmām pieprasījumu atiestatīt paroli šim kontam. Spied zemāk, lai iestatītu jaunu paroli.</p>
      <div class="warning">
        <p>⏱ Šī saite ir derīga tikai <strong>5 minūtes</strong>.</p>
      </div>
      <a href="${resetUrl}" class="cta">Atiestatīt paroli</a>
      <div class="url-fallback">
        <p>Ja poga nedarbojas, kopē šo saiti pārlūkprogrammā:</p>
        <p>${resetUrl}</p>
      </div>
    </div>
    <div class="footer">
      <p>
        Ja tu nepieprasīji paroles maiņu, droši ignorē šo e-pastu — nekas nemainīsies.<br />
        <a href="${appUrl}" style="color: #6b7280;">SkolnieksAI</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Sends a password reset email.
 * Returns true on success, false on Resend error.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<boolean> {
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: "SkolnieksAI <noreply@skolnieksai.lv>",
    to,
    subject: "Paroles atiestatīšana — SkolnieksAI",
    html: buildResetEmailHtml(resetUrl),
  });

  if (error) {
    console.error("[password-reset] Failed to send email to", to, error);
    return false;
  }

  return true;
}
