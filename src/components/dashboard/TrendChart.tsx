"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../ui/Card";

type TrendPoint = {
  label: string;
  passRate: number;
  runName: string;
};

type TrendChartProps = {
  data: TrendPoint[];
  summary: string;
  subtitle?: string;
};

export function TrendChart({
  data,
  summary,
  subtitle = "Pass rate trend by recent manual runs",
}: TrendChartProps) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Execution Trend</p>
          <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
          Latest manual runs
        </span>
      </div>

      <p className="mt-3 text-sm font-semibold text-ink">{summary}</p>

      <div className="mt-3 flex-1" style={{ minHeight: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke)" vertical={false} />
            <XAxis
              dataKey="label"
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
              formatter={(value: number | undefined, _name: string | undefined, item: { payload?: TrendPoint }) => [
                `${value ?? 0}%`,
                item.payload?.runName ? `Pass rate · ${item.payload.runName}` : "Pass rate",
              ]}
            />
            <Line
              type="monotone"
              dataKey="passRate"
              name="Pass rate %"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
