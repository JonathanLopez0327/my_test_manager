"use client";

import { Card } from "../ui/Card";

type StatusSlice = {
  name: string;
  value: number;
  color: string;
  percentage: number;
};

type TestStatusChartProps = {
  data: StatusSlice[];
  total: number;
  passRate: number;
  runLabel: string;
};

export function TestStatusChart({ data, total, passRate, runLabel }: TestStatusChartProps) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Latest Run Distribution</p>
          <p className="mt-1 text-xs text-ink-muted">Breakdown from latest manual run</p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          {total.toLocaleString("en-US")} cases
        </span>
      </div>

      <div className="mt-4">
        <p className="text-[34px] font-semibold leading-none text-ink">{passRate}%</p>
        <p className="mt-1 text-xs font-medium text-ink-muted">Pass rate from latest run</p>
      </div>

      <p className="mt-2 truncate text-xs text-ink-soft">{runLabel}</p>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-muted">
        <div className="flex h-full w-full">
          {data.map((entry) => (
            <div
              key={entry.name}
              className="h-full"
              style={{ width: `${Math.max(entry.percentage, 1)}%`, backgroundColor: entry.color }}
              aria-hidden
            />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between rounded-lg border border-stroke bg-surface-muted/50 px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-medium text-ink-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="text-xs font-semibold text-ink">
              {entry.value.toLocaleString("en-US")} ({entry.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
