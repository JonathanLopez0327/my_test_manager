import { Resend } from "resend";
import { buildBetaCodeEmail } from "@/components/email/email-template";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBetaCodeEmail(to: string, code: string): Promise<void> {
  const { subject, html } = buildBetaCodeEmail(code);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@yourdomain.com",
    to,
    subject,
    html,
  });
}
