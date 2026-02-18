import type { ButtonHTMLAttributes } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "soft"
  | "outline"
  | "critical"
  | "quiet";
type ButtonSize = "sm" | "md" | "lg" | "xs";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-all duration-200 ease-[var(--ease-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white shadow-soft-xs hover:bg-brand-700 hover:-translate-y-px",
  secondary: "border border-stroke-strong bg-surface-elevated text-ink hover:border-brand-300 hover:bg-brand-50/40",
  ghost: "bg-transparent text-ink-muted hover:bg-brand-50/70 hover:text-ink",
  danger: "bg-danger-600 text-white shadow-soft-xs hover:bg-danger-700 hover:-translate-y-px",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
  outline: "border border-stroke-strong bg-transparent text-ink hover:border-brand-500/55 hover:bg-brand-50/35",
  critical: "bg-danger-100 text-danger-700 hover:bg-danger-500/15",
  quiet: "bg-transparent text-ink-soft hover:bg-surface-muted hover:text-ink",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-8 px-3 text-xs",
  sm: "h-9 px-4 text-sm",
  md: "h-10 px-5 text-sm",
  lg: "h-11 px-6 text-base",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
