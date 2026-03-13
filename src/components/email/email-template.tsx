export function buildBetaCodeEmail(code: string): { subject: string; html: string } {
  return {
    subject: "Your Test Manager beta access code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin-bottom:8px">You're in.</h2>
        <p>Here is your beta access code for Test Manager:</p>
        <div style="background:#f4f4f5;border-radius:8px;padding:16px 24px;text-align:center;
                    font-size:24px;font-weight:700;letter-spacing:4px;margin:24px 0">
          ${code}
        </div>
        <p>Use it at the sign-up page to create your account.</p>
        <a href="${process.env.NEXTAUTH_URL}/sign-up"
           style="display:inline-block;background:#6d59ff;color:#fff;
                  text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
          Create your account
        </a>
        <p style="color:#888;font-size:12px;margin-top:32px">
          If you didn't request this, ignore this email.
        </p>
      </div>`,
  };
}
