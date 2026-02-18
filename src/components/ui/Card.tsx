import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  elevation?: "flat" | "raised";
  padding?: "none" | "sm" | "md" | "lg";
};

const elevations = {
  flat: "shadow-none",
  raised: "shadow-soft-sm",
};

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  className = "",
  elevation = "raised",
  padding = "none",
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-stroke bg-surface-elevated ${elevations[elevation]} ${paddings[padding]} ${className}`}
      {...props}
    />
  );
}
