import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type WorkspaceVariant = "default" | "wide" | "narrow";

type WorkspaceShellProps = {
  children: ReactNode;
  variant?: WorkspaceVariant;
  className?: string;
  contentClassName?: string;
};

const variantClassMap: Record<WorkspaceVariant, string> = {
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

