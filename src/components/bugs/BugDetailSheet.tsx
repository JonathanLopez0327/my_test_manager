"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { IconTrash } from "../icons";
import type { BugRecord, BugCommentRecord, BugStatus, BugSeverity } from "./types";

type BugDetailSheetProps = {
  open: boolean;
  bug: BugRecord | null;
  onClose: () => void;
  canComment?: boolean;
  canDeleteComment?: boolean;
  currentUserId?: string;
};

const statusLabels: Record<BugStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  verified: "Verified",
  closed: "Closed",
  reopened: "Reopened",
};

const statusTones: Record<BugStatus, "success" | "warning" | "danger" | "neutral"> = {
  open: "neutral",
  in_progress: "warning",
  resolved: "success",
  verified: "success",
  closed: "neutral",
  reopened: "danger",
};

const severityTones: Record<BugSeverity, "success" | "warning" | "danger" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "neutral",
  low: "success",
};

function getUserName(user: { fullName: string | null; email: string } | null) {
  if (!user) return "Unknown";
  return user.fullName || user.email;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

type Tab = "details" | "comments";

export function BugDetailSheet({
  open,
  bug,
  onClose,
  canComment = true,
  canDeleteComment = false,
  currentUserId,
}: BugDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [comments, setComments] = useState<BugCommentRecord[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!bug) return;
    setLoadingComments(true);
    try {
      const response = await fetch(`/api/bugs/${bug.id}/comments?page=1&pageSize=50`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.items ?? []);
      }
    } finally {
      setLoadingComments(false);
    }
  }, [bug]);

  useEffect(() => {
    if (open && bug) {
      setActiveTab("details");
      setCommentText("");
      fetchComments();
    }
  }, [open, bug, fetchComments]);

  const handleAddComment = async () => {
    if (!bug || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/bugs/${bug.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (response.ok) {
        setCommentText("");
        await fetchComments();
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!bug) return;
    const response = await fetch(`/api/bugs/${bug.id}/comments/${commentId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      await fetchComments();
    }
  };

  if (!bug) return null;

  return (
    <Sheet open={open} title={bug.title} description={`${bug.project.key} · ${bug.project.name}`} onClose={onClose} width="2xl">
      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-stroke bg-surface-muted p-1">
        <button
          onClick={() => setActiveTab("details")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "details"
              ? "bg-surface-elevated dark:bg-surface-muted text-ink shadow-soft-xs"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab("comments")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "comments"
              ? "bg-surface-elevated dark:bg-surface-muted text-ink shadow-soft-xs"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Comments ({comments.length})
        </button>
      </div>

      {activeTab === "details" ? (
        <div className="space-y-6">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTones[bug.status]}>{statusLabels[bug.status]}</Badge>
            <Badge tone={severityTones[bug.severity]}>{bug.severity}</Badge>
            <Badge tone="neutral">{bug.type}</Badge>
            <Badge tone="neutral">P{bug.priority}</Badge>
          </div>

          {/* Info grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Reporter</p>
              <p className="mt-1 text-sm text-ink">{getUserName(bug.reporter)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Assigned To</p>
              <p className="mt-1 text-sm text-ink">{getUserName(bug.assignedTo)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Created</p>
              <p className="mt-1 text-sm text-ink">{formatDate(bug.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Updated</p>
              <p className="mt-1 text-sm text-ink">{formatDate(bug.updatedAt)}</p>
            </div>
            {bug.environment ? (
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Environment</p>
                <p className="mt-1 text-sm text-ink">{bug.environment}</p>
              </div>
            ) : null}
            {bug.testCase ? (
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Linked Test Case</p>
                <p className="mt-1 text-sm text-ink">{bug.testCase.title}</p>
              </div>
            ) : null}
          </div>

          {/* Description */}
          {bug.description ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Description</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{bug.description}</p>
            </div>
          ) : null}

          {/* Reproduction steps */}
          {bug.reproductionSteps ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Reproduction Steps</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{bug.reproductionSteps}</p>
            </div>
          ) : null}

          {/* Expected vs Actual */}
          {(bug.expectedResult || bug.actualResult) ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {bug.expectedResult ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Expected Result</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{bug.expectedResult}</p>
                </div>
              ) : null}
              {bug.actualResult ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Actual Result</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{bug.actualResult}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Tags */}
          {bug.tags.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Tags</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {bug.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        /* Comments tab */
        <div className="space-y-4">
          {loadingComments ? (
            <p className="text-sm text-ink-muted">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-ink-muted">No comments yet.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold text-ink">
                        {getUserName(comment.author)}
                      </span>
                      <span className="ml-2 text-xs text-ink-muted">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    {(canDeleteComment || comment.authorId === currentUserId) ? (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-danger-500 transition hover:bg-danger-500/10"
                        aria-label="Delete comment"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {canComment ? (
            <div className="space-y-3 border-t border-stroke pt-4">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="min-h-[80px] w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={submittingComment || !commentText.trim()}
                >
                  {submittingComment ? "Posting..." : "Add Comment"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
