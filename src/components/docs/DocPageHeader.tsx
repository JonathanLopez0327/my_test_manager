import type { ReactNode } from "react";

export function DocPageHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
}) {
  return (
    <header className="mb-10 border-b border-stroke pb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
        {eyebrow}
      </p>
      <h1 className="mt-3">{title}</h1>
      {lead ? (
        <p className="mt-3 text-base leading-7 text-ink-muted">{lead}</p>
      ) : null}
    </header>
  );
}
