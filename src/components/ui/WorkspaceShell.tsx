import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type WorkspaceVariant = "default" | "wide" | "narrow" | "full";

type WorkspaceShellProps = {
  children: ReactNode;
  variant?: WorkspaceVariant;
  className?: string;
  contentClassName?: string;
};

const variantClassMap: Record<Exclude<WorkspaceVariant, "full">, string> = {
  default: "max-w-[1600px]",
  wide: "max-w-[1800px]",
  narrow: "max-w-[900px]",
};

export function WorkspaceShell({
  children,
  variant = "default",
  className,
  contentClassName,
}: WorkspaceShellProps) {
  if (variant === "full") {
    return (
      <div className={cn("flex h-full w-full min-w-0 flex-col", className, contentClassName)}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "mx-auto w-full min-w-0 px-4 py-4 sm:px-6 md:py-6 lg:px-8 2xl:py-8",
          variantClassMap[variant],
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

