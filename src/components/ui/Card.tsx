import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-stroke bg-surface shadow-soft-sm ${className}`}
      {...props}
    />
  );
}
