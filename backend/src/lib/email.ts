import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

/** Pure check, no side effects — safe to call from request handlers to decide UI/flow branching. */
export function isEmailConfigured(): boolean {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("SMTP yapılandırılmadı, email gönderimi atlanıyor.");
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

/**
 * Sends an email if SMTP is configured. Otherwise logs and returns silently —
 * mirrors the WhatsApp integration's graceful no-op when it isn't set up either.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const client = getTransporter();
  if (!client) return;

  try {
    await client.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("Email gönderilemedi:", err);
  }
}
