import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { authOptions } from "@/lib/auth";

export default async function SignUpPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/manager");
  }

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-2">
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-8">
        <SignupForm />
      </section>

      <aside className="relative hidden overflow-hidden border-l border-white/10 bg-[linear-gradient(145deg,#121d66_0%,#101755_52%,#151d73_100%)] md:flex md:items-center md:justify-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:56px_56px]" />
          <div className="absolute inset-y-1/4 left-0 right-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.14),transparent)]" />
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand-500/35 blur-3xl" />
          <div className="absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-accent-500/30 blur-3xl" />
          <div className="absolute left-16 top-24 h-16 w-16 rounded-md bg-white/10" />
          <div className="absolute right-20 top-1/2 h-20 w-20 rounded-md bg-white/10" />
        </div>

        <div className="relative z-10 flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-white/20 bg-white/5 px-10 py-12 text-center backdrop-blur-sm">
          <BrandLogo variant="full" className="h-14 w-auto object-contain" priority />
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Test Manager
          </h2>
          <p className="text-sm text-white/90">
            Create your tenant workspace and start managing quality operations.
          </p>
        </div>
      </aside>
    </div>
  );
}
