import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`h-11 w-full rounded-2xl border border-stroke bg-white/80 px-4 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 ${className}`}
      {...props}
    />
  );
}
