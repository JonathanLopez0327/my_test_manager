import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function LoginForm() {
  return (
    <div className="w-full max-w-md rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-soft backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
          Test Manager
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sign in to continue reviewing runs and managing test plans.
        </p>
      </div>

      <form className="mt-8 flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold text-ink-muted">Email</label>
          <Input type="email" placeholder="qa.lead@product.io" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-muted">Password</label>
          <Input type="password" placeholder="••••••••" />
        </div>
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" />
            Remember me
          </label>
          <button className="font-semibold text-brand-700">Forgot?</button>
        </div>
        <Button className="mt-2">Sign in</Button>
      </form>

      <div className="mt-8 rounded-3xl bg-brand-50 px-5 py-4 text-xs text-ink-muted">
        <p className="font-semibold text-ink">Next Auth ready</p>
        <p className="mt-2">
          Connect your provider to enable secure logins for every project.
        </p>
      </div>
    </div>
  );
}
