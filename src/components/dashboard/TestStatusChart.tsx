"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
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
  const valueByStatus = data.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.name.toLowerCase()] = entry.value;
    return acc;
  }, {});

  const compactSummaryParts = [
    `${valueByStatus.passed ?? 0} passed`,
    `${valueByStatus.failed ?? 0} failed`,
    `${valueByStatus.blocked ?? 0} blocked`,
  ];

  if ((valueByStatus.skipped ?? 0) > 0) {
    compactSummaryParts.push(`${valueByStatus.skipped} skipped`);
  }

  if ((valueByStatus["not run"] ?? 0) > 0) {
    compactSummaryParts.push(`${valueByStatus["not run"]} not run`);
  }

  const compactSummary = compactSummaryParts.join(" \u00b7 ");

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

      <p className="mt-3 truncate text-xs text-ink-soft">
        <span className="font-medium text-ink-muted">Latest run:</span> {runLabel}
      </p>

      <div className="relative mt-3 flex-1" style={{ minHeight: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={88}
              paddingAngle={1.5}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-elevated)",
                border: "1px solid var(--stroke)",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "var(--shadow-soft-sm)",
                color: "var(--ink)",
              }}
              itemStyle={{ color: "var(--ink)" }}
              labelStyle={{ color: "var(--ink-muted)", fontWeight: 600 }}
              formatter={(value: number, name: string) => [
                `${value.toLocaleString("en-US")} cases`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[30px] font-semibold leading-none text-ink">{passRate}%</p>
          <p className="text-[11px] text-ink-soft">Pass rate</p>
        </div>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-muted">{compactSummary}</p>

      <div className="mt-3 rounded-xl border border-stroke bg-surface-muted/35 p-2.5">
        <div className="grid gap-1.5">
          {data.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center justify-between rounded-lg border border-stroke/80 bg-surface-elevated/70 px-3 py-2"
            >
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
      </div>
    </Card>
  );
}
