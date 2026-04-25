import { getServerSession } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function SignUpPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/manager");
  }

  const { email } = await searchParams;

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-2">
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-semibold text-ink">Signup request received</h1>
          <p className="mt-3 text-base text-ink-muted">
            Thanks for signing up. An admin will review your request within
            24-48 hours, and we&apos;ll email you at{" "}
            <span className="font-semibold text-ink">{email}</span> once your
            account is active.
          </p>

          <div className="mt-8 rounded-xl border border-stroke bg-surface-muted px-4 py-4 text-sm text-ink-muted">
            <p className="font-medium text-ink">What happens next?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>An admin reviews your request (usually within 48 hours).</li>
              <li>
                You&apos;ll get a confirmation email once your account is
                active.
              </li>
              <li>
                If we need more information, we&apos;ll reach out to the email
                you registered with.
              </li>
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-500 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              Back to home
            </Link>
            <a
              href="mailto:support@example.com?subject=Signup%20request%20status"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Didn&apos;t get an email within 48h? Contact support
            </a>
          </div>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden border-l border-white/10 bg-[linear-gradient(145deg,#121d66_0%,#101755_52%,#151d73_100%)] md:flex md:items-center md:justify-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:56px_56px]" />
          <div className="absolute inset-y-1/4 left-0 right-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.14),transparent)]" />
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand-500/35 blur-3xl" />
          <div className="absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-accent-500/30 blur-3xl" />
        </div>

        <div className="relative z-10 flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-white/20 bg-white/5 px-10 py-12 text-center backdrop-blur-sm">
          <Image
            src="/brand/logo_dark.png"
            alt="Test Manager"
            width={512}
            height={160}
            className="h-14 w-auto object-contain"
            priority
          />
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Test Manager
          </h2>
          <p className="text-sm text-white/90">
            Centralize your entire QA workflow in one platform.
          </p>
        </div>
      </aside>
    </div>
  );
}
