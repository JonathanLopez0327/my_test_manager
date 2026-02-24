"use client";

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import { Card } from "../ui/Card";

type BugSeverityData = {
    name: string;
    value: number;
    color: string;
};

type BugSeverityChartProps = {
    data: BugSeverityData[];
    total: number;
};

export function BugSeverityChart({ data, total }: BugSeverityChartProps) {
    return (
        <Card className="flex h-full flex-col p-6">
            <div className="mb-1">
                <p className="text-sm font-semibold text-ink">Bugs por severidad</p>
                <p className="mt-0.5 text-xs text-ink-muted">Bugs abiertos</p>
            </div>
            <div className="relative mt-2 flex flex-1 items-center justify-center" style={{ minHeight: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={76}
                            paddingAngle={3}
                            dataKey="value"
                            strokeWidth={0}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "var(--surface-elevated)",
                                border: "1px solid var(--stroke)",
                                borderRadius: 8,
                                fontSize: 12,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            }}
                            formatter={(value: number | undefined) => [`${value ?? 0} bugs`, ""]}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-ink">{total}</span>
                    <span className="text-[10px] font-medium text-ink-muted">Total</span>
                </div>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
                {data.map((entry) => (
                    <span key={entry.name} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        {entry.name} ({entry.value})
                    </span>
                ))}
            </div>
        </Card>
    );
}
