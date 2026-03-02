import type { ButtonHTMLAttributes, ReactNode } from "react";

type RowActionButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  icon: ReactNode;
  label: string;
  tone?: "default" | "danger";
  size?: "sm" | "md";
};

const sizeClassMap = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
};

const toneClassMap = {
  default:
    "text-ink-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
  danger: "text-danger-500 hover:bg-danger-500/10",
};

export function RowActionButton({
  icon,
  label,
  tone = "default",
  size = "sm",
  type = "button",
  className = "",
  ...props
}: RowActionButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-lg border border-stroke transition-all duration-200 ease-[var(--ease-emphasis)] ${sizeClassMap[size]} ${toneClassMap[tone]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
