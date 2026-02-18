import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  hint?: string;
  label?: string;
  leadingIcon?: ReactNode;
};

export function Input({
  className = "",
  error,
  hint,
  label,
  leadingIcon,
  id,
  ...props
}: InputProps) {
  const resolvedId = id ?? props.name ?? undefined;

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={resolvedId}
          className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-muted"
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
            {leadingIcon}
          </span>
        ) : null}
        <input
          id={resolvedId}
          className={`h-10 w-full rounded-xl border bg-surface-elevated px-4 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] placeholder:text-ink-soft/80 focus:border-brand-300 focus:ring-2 focus:ring-[var(--focus-ring)] ${error ? "border-danger-500" : "border-stroke"} ${leadingIcon ? "pl-10" : ""} ${className}`}
          {...props}
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs font-semibold text-danger-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
