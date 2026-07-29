import nodemailer from 'nodemailer';
import { env } from '../config/env';

/**
 * Email delivery is abstracted behind this single function so the rest of the app never
 * needs to know HOW an email is actually sent. In production, this would be configured
 * with real SMTP credentials (e.g. SendGrid, AWS SES, Mailgun). In development, with no
 * SMTP configured, it falls back to logging the email content to the console - so the
 * password reset flow is fully testable without needing a real mail server.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!env.smtpHost) {
    console.log('\n--- [DEV MODE] Email not sent (no SMTP configured) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log('--- end email ---\n');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });

  await transporter.sendMail({
    from: env.mailFrom,
    to,
    subject,
    text,
  });
}
