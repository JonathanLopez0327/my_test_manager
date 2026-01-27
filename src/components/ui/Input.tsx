import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`h-10 w-full rounded-lg border border-stroke bg-white px-4 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 ${className}`}
      {...props}
    />
  );
}
