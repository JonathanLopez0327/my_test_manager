import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  InviteError,
  validateInviteToken,
} from "@/lib/invites/invite-service";
import { AcceptInviteButton } from "./AcceptInviteButton";

type InviteView =
  | {
      kind: "valid";
      email: string;
      role: string;
      organizationName: string;
      organizationSlug: string;
      expiresAt: Date;
    }
  | {
      kind: "error";
      title: string;
      description: string;
    };

async function loadInvite(token: string): Promise<InviteView> {
  try {
    const invite = await validateInviteToken(token, prisma);
    return {
      kind: "valid",
      email: invite.email,
      role: invite.role,
      organizationName: invite.organizationName,
      organizationSlug: invite.organizationSlug,
      expiresAt: invite.expiresAt,
    };
  } catch (error) {
    if (error instanceof InviteError) {
      const title =
        error.code === "INVITE_EXPIRED"
          ? "This invite has expired"
          : error.code === "INVITE_NOT_FOUND"
            ? "Invite not found"
            : "This invite is no longer valid";
      return {
        kind: "error",
        title,
        description: error.message,
      };
    }
    return {
      kind: "error",
      title: "Something went wrong",
      description: "We could not load this invite. Please try again later.",
    };
  }
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [view, session] = await Promise.all([
    loadInvite(token),
    getServerSession(authOptions),
  ]);

  const userEmail = session?.user?.email ?? null;
  const isAuthenticated = Boolean(session?.user?.id);

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-2">
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Image
            src="/brand/logo_light.png"
            alt="Test Manager"
            width={180}
            height={48}
            className="h-10 w-auto object-contain dark:hidden"
            priority
          />
          <Image
            src="/brand/logo_dark.png"
            alt="Test Manager"
            width={180}
            height={48}
            className="hidden h-10 w-auto object-contain dark:block"
            priority
          />

          {view.kind === "error" ? (
            <>
              <h1 className="mt-8 text-4xl font-semibold text-ink">
                {view.title}
              </h1>
              <p className="mt-3 text-base text-ink-muted">{view.description}</p>
              <div className="mt-8">
                <Link
                  href="/"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-500 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
                >
                  Back to home
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-8 text-4xl font-semibold text-ink">
                You&apos;ve been invited
              </h1>
              <p className="mt-3 text-base text-ink-muted">
                Join{" "}
                <span className="font-semibold text-ink">
                  {view.organizationName}
                </span>{" "}
                as{" "}
                <span className="font-semibold text-ink">{view.role}</span>.
              </p>

              <div className="mt-6 rounded-xl border border-stroke bg-surface-muted px-4 py-4 text-sm text-ink-muted">
                <p>
                  This invite was sent to{" "}
                  <span className="font-semibold text-ink">{view.email}</span>.
                  It expires on{" "}
                  <span className="font-semibold text-ink">
                    {view.expiresAt.toLocaleDateString()}
                  </span>
                  .
                </p>
              </div>

              {isAuthenticated ? (
                userEmail?.toLowerCase() === view.email ? (
                  <div className="mt-8">
                    <AcceptInviteButton token={token} />
                  </div>
                ) : (
                  <div className="mt-8 rounded-lg bg-warning-500/10 px-4 py-3 text-sm text-warning-600 dark:text-warning-500">
                    You&apos;re currently signed in as{" "}
                    <span className="font-semibold">{userEmail}</span>, but this
                    invite was sent to{" "}
                    <span className="font-semibold">{view.email}</span>. Please
                    sign out and sign in with the invited email to accept.
                  </div>
                )
              ) : (
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-500 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
                  >
                    Sign in to accept
                  </Link>
                  <Link
                    href={`/sign-up?invite=${encodeURIComponent(token)}`}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-stroke px-5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
                  >
                    Create an account
                  </Link>
                </div>
              )}
            </>
          )}
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
