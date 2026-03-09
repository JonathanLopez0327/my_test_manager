"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../ui/Card";

type DayData = {
  day: string;
  passed: number;
  failed: number;
};

type TrendPeriod = "weekly" | "monthly";

type TrendChartProps = {
  data: DayData[];
  period?: TrendPeriod;
  summary: string;
  subtitle?: string;
  failedPeak?: {
    day: string;
    failed: number;
  } | null;
};

export function TrendChart({
  data,
  period = "weekly",
  summary,
  subtitle = "Activity over the last days",
  failedPeak,
}: TrendChartProps) {
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Execution trends</p>
          <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-stroke bg-surface-muted/70 p-1 text-[11px] font-semibold">
          <span
            className={`rounded-md px-2.5 py-1 transition-colors ${period === "weekly" ? "bg-surface-elevated text-ink shadow-soft-xs" : "text-ink-soft"}`}
          >
            Weekly
          </span>
          <span
            className={`rounded-md px-2.5 py-1 transition-colors ${period === "monthly" ? "bg-surface-elevated text-ink shadow-soft-xs" : "text-ink-soft"}`}
          >
            Monthly
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <p className="text-2xl font-semibold text-ink">{summary}</p>
        {failedPeak ? (
          <span className="rounded-full bg-danger-500/10 px-3 py-1 text-xs font-semibold text-danger-500">
            Pico de fallos: {failedPeak.failed} ({failedPeak.day})
          </span>
        ) : (
          <span className="rounded-full bg-success-500/10 px-3 py-1 text-xs font-semibold text-success-500">
            No failure anomalies
          </span>
        )}
      </div>

      <div className="mt-4 flex-1" style={{ minHeight: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="trendPassed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="trendFailed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#DC2626" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#DC2626" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-elevated)",
                border: "1px solid var(--stroke)",
                borderRadius: 10,
                fontSize: 12,
                boxShadow: "var(--shadow-soft-sm)",
              }}
              labelStyle={{ fontWeight: 600, color: "var(--ink)" }}
            />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
            <Area
              type="monotone"
              dataKey="passed"
              name="Passed"
              stroke="#059669"
              strokeWidth={2.2}
              fill="url(#trendPassed)"
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="failed"
              name="Failed"
              stroke="#DC2626"
              strokeWidth={2.2}
              fill="url(#trendFailed)"
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
