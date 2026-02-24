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
          className="mb-1.5 block text-sm font-medium text-ink dark:text-white"
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
          className={`h-10 w-full rounded-lg border-[1.5px] bg-surface-elevated px-4 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] placeholder:text-ink-soft/80 focus:border-brand-500 dark:bg-surface-muted dark:text-white ${error ? "border-danger-500" : "border-stroke"} ${leadingIcon ? "pl-10" : ""} ${className}`}
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
