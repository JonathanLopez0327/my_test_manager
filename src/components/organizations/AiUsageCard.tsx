"use client";

import { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";

type UsageResponse = {
  limit: number;
  periodStart: string;
  periodEnd: string;
  inputTokens: string;
  outputTokens: string;
  totalTokens: string;
};

function formatNumber(n: bigint | number): string {
  return new Intl.NumberFormat().format(typeof n === "bigint" ? Number(n) : n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AiUsageCard() {
  const t = useT();
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/organizations/current/usage");
        if (!res.ok) throw new Error(t.aiUsage.couldNotLoad);
        const json = (await res.json()) as UsageResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t.common.error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-muted">{t.aiUsage.loading}</p>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-danger-500">{error ?? t.aiUsage.couldNotLoadFallback}</p>
      </Card>
    );
  }

  const total = BigInt(data.totalTokens);
  const input = BigInt(data.inputTokens);
  const output = BigInt(data.outputTokens);
  const limit = data.limit;
  const pct =
    limit > 0
      ? Math.min(100, Number((total * BigInt(100)) / BigInt(limit)))
      : 0;

  const barColor =
    pct >= 100
      ? "bg-danger-500"
      : pct >= 80
        ? "bg-warning-500"
        : "bg-brand-500";

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{t.aiUsage.title}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {formatMessage(t.aiUsage.period, {
              start: formatDate(data.periodStart),
              end: formatDate(data.periodEnd),
            })}
          </p>
        </div>
        <p className="text-sm font-medium text-ink">
          {formatNumber(total)}{" "}
          <span className="text-ink-muted">/ {formatNumber(limit)}</span>
        </p>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-ink-muted">{t.aiUsage.input}</dt>
          <dd className="mt-0.5 font-medium text-ink">{formatNumber(input)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t.aiUsage.output}</dt>
          <dd className="mt-0.5 font-medium text-ink">{formatNumber(output)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t.aiUsage.used}</dt>
          <dd className="mt-0.5 font-medium text-ink">{pct}%</dd>
        </div>
      </dl>

      {pct >= 100 && (
        <p className="mt-3 text-xs text-danger-500">
          {t.aiUsage.quotaExceeded}
        </p>
      )}
      {pct >= 80 && pct < 100 && (
        <p className="mt-3 text-xs text-warning-600">
          {t.aiUsage.quotaNear}
        </p>
      )}
    </Card>
  );
}
