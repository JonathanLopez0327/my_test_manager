import type { ReactNode } from "react";
import { Card } from "../ui/Card";

type StatCardProps = {
  title: string;
  value: string;
  change: string;
  icon: ReactNode;
  accent: string;
};

export function StatCard({ title, value, change, icon, accent }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
          {title}
        </p>
        <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
        <p className="mt-1 text-xs font-medium text-ink-muted">{change}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}>
        {icon}
      </div>
      </div>
    </Card>
  );
}
