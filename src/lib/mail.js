import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getContact } from "./contact";

const BRAND_NAME = getContact("brand.productName", "RapportLook");
// emails.noreply is still a TODO placeholder in data/contact.json — falls
// back to the brand's own domain rather than a stale one once it's filled in.
const NOREPLY_EMAIL = getContact("emails.noreply", "no-reply@rapportlook.com");

// Brand purple (--color-brand-600 in globals.css) as a plain hex — email
// clients don't render oklch(), so this is a one-time manual translation,
// not read from the CSS. Keep it in sync by eye if the brand color moves.
const BRAND_PURPLE = "#7c1fd6";

/**
 * SECURITY — nodemailer 7.0.13 ships unpatched CVEs (SMTP command injection via
 * envelope options, CRLF injection via transport name and List-* headers).
 * There is no fixed release upstream.
 *
 * The rule that keeps us out of range: transport config is built ONLY from env
 * vars, never from request data, and callers may only influence `to`, `subject`,
 * and the body. Do not add an `envelope`, `raw`, or `list` option to sendMail
 * below, and do not thread user input into createTransport.
 */
let transporter;

function getTransport() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP_* env vars are not configured. See .env.local.example");
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

/** `to` is an email address only. Reject anything with CR/LF before it reaches SMTP. */
function assertSafeHeaderValue(value, field) {
  if (/[\r\n]/.test(value)) {
    throw new Error(`Illegal newline in ${field}`);
  }
  return value;
}

// Read once and keep in memory — the logo file doesn't change at runtime,
// no reason to hit disk on every send. Embedded via cid rather than a remote
// <img src>, so it renders in dev (no public URL to fetch) and in clients
// that block remote images by default.
let logoAttachment;
function getLogoAttachment() {
  if (logoAttachment !== undefined) return logoAttachment;
  try {
    logoAttachment = {
      filename: "logo.png",
      content: readFileSync(join(process.cwd(), "public", "img", "logo3.png")),
      cid: "brand-logo",
    };
  } catch {
    // Missing in some deploy environments (e.g. a slim build without
    // /public) shouldn't take mail sending down with it.
    logoAttachment = null;
  }
  return logoAttachment;
}

/**
 * Shared HTML shell for every transactional email: logo header, a white card
 * for the message, and a footer. Table-based layout with inline styles only —
 * the constraints most email clients (Outlook/Gmail) actually render
 * correctly, not the flexbox/grid the rest of the app uses.
 */
function renderEmailShell({ preheader, bodyHtml }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${BRAND_NAME}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <!-- Preheader: shows as the inbox preview snippet, hidden in the body -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader ?? ""}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f2f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
            <!-- Logo header -->
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <img
                  src="cid:brand-logo"
                  alt="${BRAND_NAME}"
                  width="140"
                  style="display:block;width:140px;height:auto;border:0;"
                />
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color:#ffffff;border:1px solid #e8e4ef;border-radius:16px;padding:36px 32px;">
                ${bodyHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top:24px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#8b8698;">
                  &copy; ${year} ${BRAND_NAME}. All rights reserved.
                </p>
                <p style="margin:4px 0 0;font-size:12px;line-height:1.6;color:#8b8698;">
                  This is an automated message — please don't reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function send({ to, subject, text, html, preheader }) {
  assertSafeHeaderValue(to, "to");
  assertSafeHeaderValue(subject, "subject");

  const from = process.env.MAIL_FROM ?? `${BRAND_NAME} <${NOREPLY_EMAIL}>`;
  const fullHtml = renderEmailShell({ preheader, bodyHtml: html });
  const logo = getLogoAttachment();

  if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST) {
    console.log(`\n[mail:dev] to=${to}\n[mail:dev] subject=${subject}\n[mail:dev] ${text}\n`);
    return;
  }

  await getTransport().sendMail({
    from,
    to,
    subject,
    text,
    html: fullHtml,
    attachments: logo ? [logo] : [],
  });
}

export async function sendOtpEmail(to, code) {
  // Spaced-out digits so the code is easy to scan/copy at a glance.
  const spacedCode = String(code).split("").join(" ");

  return send({
    to,
    subject: `Your ${BRAND_NAME} verification code`,
    preheader: `Your verification code is ${code}`,
    text: `Your ${BRAND_NAME} verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
    html: `
      <h1 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#1a1523;">Verify your email</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5b5566;">
        Enter this code to finish signing in to ${BRAND_NAME}.
      </p>
      <div style="margin:0 0 24px;padding:18px 12px;background-color:#f6f1fd;border:1px solid #e3d6fb;border-radius:12px;text-align:center;">
        <span style="font-size:30px;font-weight:700;letter-spacing:6px;color:${BRAND_PURPLE};font-family:'Courier New',monospace;">
          ${spacedCode}
        </span>
      </div>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#8b8698;">
        This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
      </p>
    `,
  });
}

export async function sendPasswordResetEmail(to, token) {
  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${encodeURIComponent(token)}`;

  return send({
    to,
    subject: `Reset your ${BRAND_NAME} password`,
    preheader: "Use this link to reset your password",
    text: `Reset your password: ${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email — your password is unchanged.`,
    html: `
      <h1 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#1a1523;">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5b5566;">
        Click the button below to choose a new password for your ${BRAND_NAME} account.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="border-radius:10px;background-color:${BRAND_PURPLE};">
            <a
              href="${url}"
              style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;"
            >
              Reset password
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#8b8698;">
        Or paste this link into your browser:
      </p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;">
        <a href="${url}" style="color:${BRAND_PURPLE};">${url}</a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#8b8698;">
        This link expires in 1 hour. If you didn't request this, ignore this email — your password is unchanged.
      </p>
    `,
  });
}
