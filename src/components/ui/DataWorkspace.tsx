import type { ReactNode } from "react";
import { Card } from "./Card";

type DataWorkspaceProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  toolbar: ReactNode;
  status?: ReactNode;
  feedback?: ReactNode;
  content: ReactNode;
  footer?: ReactNode;
};

export function DataWorkspace({
  eyebrow,
  title,
  subtitle,
  toolbar,
  status,
  feedback,
  content,
  footer,
}: DataWorkspaceProps) {
  return (
    <Card className="overflow-hidden" padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-3xl font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="mt-2 text-sm text-ink-muted">{subtitle}</p> : null}
        </div>
        <div className="w-full lg:w-auto lg:min-w-[420px]">{toolbar}</div>
      </div>

      {status ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">{status}</div>
      ) : null}

      {feedback ? <div className="mt-4 space-y-3">{feedback}</div> : null}

      <div className="mt-6">{content}</div>

      {footer ? <div className="mt-6">{footer}</div> : null}
    </Card>
  );
}
