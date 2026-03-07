import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  elevation?: "flat" | "raised";
  padding?: "none" | "sm" | "md" | "lg";
};

const elevations = {
  flat: "shadow-none",
  raised: "shadow-[0_10px_24px_-18px_rgba(21,33,62,0.35)]",
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
      className={`rounded-xl border border-stroke bg-surface-elevated dark:bg-surface-muted ${elevations[elevation]} ${paddings[padding]} ${className}`}
      {...props}
    />
  );
}
