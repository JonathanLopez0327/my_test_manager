import type { TestRunStatus } from "@/generated/prisma/client";
import type { RunStatusTone } from "./types";

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }
  return Number(value ?? 0);
}

export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const mins = Math.max(1, Math.round(diff / minute));
    return `hace ${mins} min`;
  }
  if (diff < day) {
    const hours = Math.round(diff / hour);
    return `hace ${hours} h`;
  }
  const days = Math.round(diff / day);
  return `hace ${days} d`;
}

export function formatDuration(
  durationMs?: number | bigint | null,
  startedAt?: Date | null,
  finishedAt?: Date | null,
): string {
  let ms = durationMs ? Number(durationMs) : 0;
  if (!ms && startedAt && finishedAt) {
    ms = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  }
  if (!ms) return "No duration";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m ${seconds}s`;

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}

export function statusTone(status: TestRunStatus): RunStatusTone {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "warning";
  return "neutral";
}

export function statusLabel(status: TestRunStatus): string {
  const labels: Record<TestRunStatus, string> = {
    completed: "Completed",
    failed: "Failed",
    running: "Running",
    queued: "Queued",
    canceled: "Canceled",
  };
  return labels[status];
}

export function formatDateTime(date: Date | null): string {
  if (!date) return "No runs yet";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
