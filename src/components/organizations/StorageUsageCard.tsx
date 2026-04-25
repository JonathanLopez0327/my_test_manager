"use client";

import { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { useT } from "@/lib/i18n/LocaleProvider";

type UsageResponse = {
  storageLimit: string;
  storageUsed: string;
};

function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageUsageCard() {
  const t = useT();
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/organizations/current/usage");
        if (!res.ok) throw new Error(t.storageUsage.couldNotLoad);
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
        <p className="text-sm text-ink-muted">{t.storageUsage.loading}</p>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-danger-500">
          {error ?? t.storageUsage.couldNotLoadFallback}
        </p>
      </Card>
    );
  }

  const used = BigInt(data.storageUsed);
  const limit = BigInt(data.storageLimit);

  if (limit <= BigInt(0)) {
    return (
      <Card className="p-6">
        <p className="text-sm font-semibold text-ink">{t.storageUsage.title}</p>
        <p className="mt-3 text-sm font-medium text-danger-500">
          {t.storageUsage.noLimitTitle}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{t.storageUsage.noLimitBody}</p>
      </Card>
    );
  }

  const pct = Math.min(100, Number((used * BigInt(100)) / limit));

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
          <p className="text-sm font-semibold text-ink">{t.storageUsage.title}</p>
          <p className="mt-1 text-xs text-ink-muted">{t.storageUsage.subtitle}</p>
        </div>
        <p className="text-sm font-medium text-ink">
          {formatBytes(used)}{" "}
          <span className="text-ink-muted">/ {formatBytes(limit)}</span>
        </p>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-ink-muted">{t.storageUsage.used}</dt>
          <dd className="mt-0.5 font-medium text-ink">{pct}%</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t.storageUsage.remaining}</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {formatBytes(used >= limit ? BigInt(0) : limit - used)}
          </dd>
        </div>
      </dl>

      {pct >= 100 && (
        <p className="mt-3 text-xs text-danger-500">
          {t.storageUsage.quotaExceeded}
        </p>
      )}
      {pct >= 80 && pct < 100 && (
        <p className="mt-3 text-xs text-warning-600">
          {t.storageUsage.quotaNear}
        </p>
      )}
    </Card>
  );
}
