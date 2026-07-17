import nodemailer from "nodemailer";

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

async function send({ to, subject, text, html }) {
  assertSafeHeaderValue(to, "to");
  assertSafeHeaderValue(subject, "subject");

  const from = process.env.MAIL_FROM ?? "ReviewHub <no-reply@reviewhub.in>";

  if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST) {
    console.log(`\n[mail:dev] to=${to}\n[mail:dev] subject=${subject}\n[mail:dev] ${text}\n`);
    return;
  }

  await getTransport().sendMail({ from, to, subject, text, html });
}

export async function sendOtpEmail(to, code) {
  return send({
    to,
    subject: "Your ReviewHub verification code",
    text: `Your ReviewHub verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
    html: `<p>Your ReviewHub verification code is <strong style="font-size:20px;letter-spacing:3px">${code}</strong></p><p>It expires in 10 minutes. If you didn't request this, ignore this email.</p>`,
  });
}

export async function sendPasswordResetEmail(to, token) {
  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${encodeURIComponent(token)}`;
  return send({
    to,
    subject: "Reset your ReviewHub password",
    text: `Reset your password: ${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email — your password is unchanged.`,
    html: `<p><a href="${url}">Reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email — your password is unchanged.</p>`,
  });
}
