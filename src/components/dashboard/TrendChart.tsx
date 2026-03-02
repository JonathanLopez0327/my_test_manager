"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { Card } from "../ui/Card";

type DayData = {
    day: string;
    passed: number;
    failed: number;
};

type TrendChartProps = {
    data: DayData[];
};

export function TrendChart({ data }: TrendChartProps) {
    return (
        <Card className="flex h-full flex-col p-6">
            <div className="mb-1 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-ink">Tendencia de ejecución</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                        Resultados de los últimos 7 días
                    </p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                    Semanal
                </span>
            </div>
            <div className="mt-4 flex-1" style={{ minHeight: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gradPassed" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
                                <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#DC2626" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="#DC2626" stopOpacity={0.02} />
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
                                borderRadius: 8,
                                fontSize: 12,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            }}
                            labelStyle={{ fontWeight: 600, color: "var(--ink)" }}
                        />
                        <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="passed"
                            name="Exitosos"
                            stroke="#059669"
                            strokeWidth={2}
                            fill="url(#gradPassed)"
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="failed"
                            name="Fallidos"
                            stroke="#DC2626"
                            strokeWidth={2}
                            fill="url(#gradFailed)"
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
