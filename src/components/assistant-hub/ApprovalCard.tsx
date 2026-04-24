"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ApprovalCall, ApprovalDecision, ApprovalStatus } from "@/lib/assistant-hub";

type Props = {
  calls: ApprovalCall[];
  status: ApprovalStatus;
  disabled: boolean;
  onSubmit: (decision: ApprovalDecision) => void;
};

type CallSummary = {
  headline: string;
  detail?: string;
  extraTitles?: string[];
};

const INITIAL_TITLES_VISIBLE = 5;

function stringArg(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function summarize(call: ApprovalCall): CallSummary {
  const args = call.args ?? {};
  if (call.name === "batch_create_test_cases") {
    const testCases = Array.isArray(args.test_cases) ? (args.test_cases as unknown[]) : [];
    const titles = testCases
      .map((tc) =>
        tc && typeof tc === "object" && typeof (tc as { title?: unknown }).title === "string"
          ? ((tc as { title: string }).title).trim()
          : "",
      )
      .filter(Boolean);
    const suiteId = stringArg(args, "suite_id");
    return {
      headline: `Create ${titles.length || testCases.length} test case${testCases.length === 1 ? "" : "s"}`,
      detail: suiteId ? `Target suite: ${suiteId}` : undefined,
      extraTitles: titles,
    };
  }
  if (call.name === "create_test_case") {
    const title = stringArg(args, "title") ?? "Untitled test case";
    const suiteId = stringArg(args, "suite_id");
    return {
      headline: `Create test case: ${title}`,
      detail: suiteId ? `Target suite: ${suiteId}` : undefined,
    };
  }
  if (call.name === "create_test_suite") {
    const name = stringArg(args, "name") ?? "Untitled suite";
    const testPlanId = stringArg(args, "test_plan_id");
    return {
      headline: `Create test suite: ${name}`,
      detail: testPlanId ? `Test plan: ${testPlanId}` : undefined,
    };
  }
  return { headline: `Run ${call.name}` };
}

type CallRowProps = {
  call: ApprovalCall;
  selectable: boolean;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
};

function CallRow({ call, selectable, checked, onToggle, disabled }: CallRowProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarize(call);
  const extraTitles = summary.extraTitles ?? [];
  const hasOverflow = extraTitles.length > INITIAL_TITLES_VISIBLE;
  const visibleTitles = expanded ? extraTitles : extraTitles.slice(0, INITIAL_TITLES_VISIBLE);

  return (
    <li className="rounded-lg border border-stroke bg-surface px-3 py-2 text-[12px] leading-relaxed text-ink">
      <div className="flex items-start gap-2">
        {selectable ? (
          <input
            type="checkbox"
            className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-brand-600 disabled:cursor-not-allowed"
            checked={checked}
            onChange={onToggle}
            disabled={disabled}
            aria-label={`Include ${summary.headline}`}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{summary.headline}</p>
          {summary.detail ? (
            <p className="mt-0.5 text-[11px] text-ink-muted">{summary.detail}</p>
          ) : null}
          {extraTitles.length > 0 ? (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] text-ink">
              {visibleTitles.map((title, idx) => (
                <li key={`${call.id}-${idx}`}>{title}</li>
              ))}
            </ul>
          ) : null}
          {hasOverflow ? (
            <button
              type="button"
              className="mt-1 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? "Show less" : `Show ${extraTitles.length - INITIAL_TITLES_VISIBLE} more`}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function ApprovalCard({ calls, status, disabled, onSubmit }: Props) {
  const pending = status === "pending";
  const selectable = calls.length > 1;

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(calls.map((c) => c.id)),
  );

  const selectedIds = useMemo(
    () => calls.filter((c) => selected.has(c.id)).map((c) => c.id),
    [calls, selected],
  );
  const allSelected = selectedIds.length === calls.length;
  const anySelected = selectedIds.length > 0;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApproveAll = () => onSubmit({ approve_all: true });
  const handleApproveSelected = () => onSubmit({ approved: selectedIds });
  const handleRejectAll = () => onSubmit({ approved: [] });

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-[13px] dark:border-amber-400/40 dark:bg-amber-500/10">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white">
          !
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-200">
            Approve assistant action
          </p>
          <p className="mt-0.5 text-[11px] text-amber-900/80 dark:text-amber-100/80">
            The assistant wants to create items in MTM. Review what will be created before
            approving — you can reject everything, approve everything, or pick which ones
            to run.
          </p>
        </div>
      </div>

      <ul className="mt-2 space-y-2">
        {calls.map((call) => (
          <CallRow
            key={call.id}
            call={call}
            selectable={selectable}
            checked={selected.has(call.id)}
            onToggle={() => toggle(call.id)}
            disabled={!pending || disabled}
          />
        ))}
      </ul>

      <div
        className={cn(
          "mt-3 flex flex-wrap items-center gap-2",
          pending ? "" : "opacity-60",
        )}
      >
        <Button
          size="sm"
          variant="outline"
          className="border-ink/20"
          disabled={!pending || disabled}
          onClick={handleRejectAll}
          aria-label="Reject all assistant actions"
        >
          Reject all
        </Button>
        {selectable ? (
          <Button
            size="sm"
            variant="outline"
            className="border-ink/20"
            disabled={!pending || disabled || !anySelected || allSelected}
            onClick={handleApproveSelected}
            aria-label="Approve selected assistant actions"
          >
            Approve selected ({selectedIds.length})
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={!pending || disabled}
          onClick={handleApproveAll}
          aria-label="Approve all assistant actions"
        >
          Approve all
        </Button>
        {!pending ? (
          <span className="text-[11px] font-medium text-ink-muted">
            {status === "approved"
              ? "Approved"
              : status === "rejected"
                ? "Rejected"
                : "Could not submit"}
          </span>
        ) : null}
      </div>
    </div>
  );
}
