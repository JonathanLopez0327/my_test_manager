import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant: "full" | "icon";
  className?: string;
  priority?: boolean;
  alt?: string;
};

// Reusable app branding image.
// Full logo auto-switches between light/dark assets via CSS theme classes.
export function BrandLogo({
  variant,
  className,
  priority = false,
  alt = "Test Manager",
}: BrandLogoProps) {
  if (variant === "icon") {
    return (
      <Image
        src="/brand/icon_logo.png"
        alt={alt}
        width={128}
        height={128}
        className={className}
        priority={priority}
      />
    );
  }

  return (
    <>
      <Image
        src="/brand/logo_light.png"
        alt={alt}
        width={512}
        height={160}
        className={cn(className, "dark:hidden")}
        priority={priority}
      />
      <Image
        src="/brand/logo_dark.png"
        alt={alt}
        width={512}
        height={160}
        className={cn(className, "hidden dark:block")}
        priority={priority}
      />
    </>
  );
}
