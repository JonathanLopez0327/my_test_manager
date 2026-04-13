"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sheet } from "../ui/Sheet";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ArtifactPreview } from "../ui/ArtifactPreview";
import { IconAlert, IconCheck, IconTrash } from "../icons";
import type { BugRecord, BugCommentRecord, BugStatus, BugSeverity, BugAttachmentRecord } from "./types";
import { AssistantHubTrigger } from "@/components/assistant-hub/AssistantHubTrigger";

type BugDetailSheetProps = {
  open: boolean;
  bug: BugRecord | null;
  onClose: () => void;
  canComment?: boolean;
  canDeleteComment?: boolean;
  canListAttachments?: boolean;
  canUploadAttachments?: boolean;
  canDeleteAttachment?: boolean;
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

type Tab = "details" | "comments" | "attachments";

type RunStatusTone = "success" | "warning" | "danger" | "neutral" | "info";

function formatSize(value?: number | string | null) {
  const parsed = Number(value ?? NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let size = parsed;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function inferAttachmentPreviewType(attachment: BugAttachmentRecord) {
  const explicit = String(attachment.type ?? "").toLowerCase();
  if (explicit === "screenshot") return "image";
  if (explicit === "video") return "video";
  const mime = String(attachment.mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/") || mime.includes("json") || mime.includes("xml")) return "text";
  if (mime.includes("pdf")) return "pdf";
  return "file";
}

function toSentenceCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeReproductionSteps(raw: string | null) {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^([-*]|\d+[.)])\s+/, ""))
    .filter((line) => line.length > 0);
}

function getRunStatusTone(status?: string | null): RunStatusTone {
  if (!status) return "neutral";
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "success";
  if (normalized === "running" || normalized === "queued") return "warning";
  if (normalized === "failed") return "danger";
  return "neutral";
}

function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-stroke bg-surface-elevated p-4 shadow-soft-xs sm:p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-stroke pb-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-ink-muted">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-h-[74px] rounded-lg border border-stroke bg-surface-muted px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

export function BugDetailSheet({
  open,
  bug,
  onClose,
  canComment = true,
  canDeleteComment = false,
  canListAttachments = false,
  canUploadAttachments = false,
  canDeleteAttachment = false,
  currentUserId,
}: BugDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [comments, setComments] = useState<BugCommentRecord[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [attachments, setAttachments] = useState<BugAttachmentRecord[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [savingAttachments, setSavingAttachments] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewArtifact, setPreviewArtifact] = useState<{
    url: string;
    type: string;
    mimeType?: string | null;
    name?: string | null;
  } | null>(null);
  const reproductionSteps = useMemo(
    () => normalizeReproductionSteps(bug?.reproductionSteps ?? null),
    [bug?.reproductionSteps],
  );

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

  const fetchAttachments = useCallback(async () => {
    if (!bug || !canListAttachments) return;
    setLoadingAttachments(true);
    setAttachmentsError(null);
    try {
      const response = await fetch(`/api/bugs/${bug.id}/attachments?page=1&pageSize=50`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Could not load attachments.");
      }
      setAttachments(data.items ?? []);
    } catch (error) {
      setAttachmentsError(
        error instanceof Error ? error.message : "Could not load attachments.",
      );
    } finally {
      setLoadingAttachments(false);
    }
  }, [bug, canListAttachments]);

  useEffect(() => {
    if (open && bug) {
      setActiveTab("details");
      setCommentText("");
      setAttachmentFiles([]);
      setAttachments(bug.attachments ?? []);
      fetchComments();
      fetchAttachments();
    }
  }, [open, bug, fetchComments, fetchAttachments]);

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

  const inferAttachmentType = (file: File) => {
    const mime = (file.type || "").toLowerCase();
    if (mime.startsWith("image/")) return "screenshot";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("text/") || mime.includes("json") || mime.includes("xml")) return "log";
    return "other";
  };

  const handleUploadAttachments = async () => {
    if (!bug || !canUploadAttachments || attachmentFiles.length === 0) return;
    setSavingAttachments(true);
    setAttachmentsError(null);
    let failedUploads = 0;
    try {
      await Promise.all(
        attachmentFiles.map(async (file) => {
          const formData = new FormData();
          formData.set("file", file);
          formData.set("type", inferAttachmentType(file));
          const response = await fetch(`/api/bugs/${bug.id}/attachments/upload`, {
            method: "POST",
            body: formData,
          });
          if (!response.ok) {
            failedUploads += 1;
          }
        }),
      );
      if (failedUploads > 0) {
        setAttachmentsError(
          `${failedUploads} attachment${failedUploads === 1 ? "" : "s"} failed to upload.`,
        );
      }
      setAttachmentFiles([]);
      await fetchAttachments();
    } catch {
      setAttachmentsError("Could not upload attachments.");
    } finally {
      setSavingAttachments(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!bug || !canDeleteAttachment) return;
    const response = await fetch(`/api/bugs/${bug.id}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      await fetchAttachments();
    } else {
      setAttachmentsError("Could not delete attachment.");
    }
  };

  if (!bug) return null;

  return (
    <Sheet
      open={open}
      title="Bug Details"
      description={`${bug.project.key} · ${bug.project.name}`}
      onClose={onClose}
      width="2xl"
    >
      <div className="sticky top-0 z-30 -mx-6 mb-6 border-b border-stroke bg-surface-elevated/95 px-6 pb-4 pt-1 backdrop-blur-sm">
        <div className="rounded-xl border border-stroke bg-surface-muted px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                Issue Summary
              </p>
              <h2 className="mt-2 break-words text-xl font-semibold leading-tight text-ink">
                {bug.title}
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                {bug.project.key} · {bug.project.name}
              </p>
            </div>
            <div className="shrink-0">
              <AssistantHubTrigger
                context={{ type: "bug", bugId: bug.id, bugTitle: bug.title, projectId: bug.projectId }}
                label="Ask AI"
                variant="button"
                onBeforeOpen={onClose}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={statusTones[bug.status]}>{statusLabels[bug.status]}</Badge>
            <Badge tone={severityTones[bug.severity]}>{toSentenceCase(bug.severity)}</Badge>
            <Badge tone="neutral">{toSentenceCase(bug.type)}</Badge>
            <Badge tone="neutral">Priority P{bug.priority}</Badge>
          </div>
        </div>
      </div>

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
        {canListAttachments ? (
          <button
            onClick={() => setActiveTab("attachments")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "attachments"
                ? "bg-surface-elevated dark:bg-surface-muted text-ink shadow-soft-xs"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Attachments ({attachments.length})
          </button>
        ) : null}
      </div>

      {activeTab === "details" ? (
        <div className="space-y-5">
          <SectionCard
            title="Overview"
            subtitle="High-level ownership and timeline data for quick triage."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoCard label="Reporter" value={getUserName(bug.reporter)} />
              <InfoCard label="Assigned To" value={getUserName(bug.assignedTo)} />
              <InfoCard label="Environment" value={bug.environment || "Not specified"} />
              <InfoCard label="Created" value={formatDate(bug.createdAt)} />
              <InfoCard label="Updated" value={formatDate(bug.updatedAt)} />
              <InfoCard label="Bug ID" value={bug.id} />
            </div>
          </SectionCard>

          <SectionCard
            title="QA Context"
            subtitle="Execution traceability and linked test management entities."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard
                label="Found in Test Run"
                value={bug.testRun ? (bug.testRun.name || bug.testRun.id) : "Not linked"}
              />
              <div className="min-h-[74px] rounded-lg border border-stroke bg-surface-muted px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  Test Run Status
                </p>
                {bug.testRun?.status ? (
                  <div className="mt-2">
                    <Badge tone={getRunStatusTone(bug.testRun.status)}>
                      {toSentenceCase(bug.testRun.status)}
                    </Badge>
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-medium text-ink">Unavailable</p>
                )}
              </div>
              <InfoCard
                label="Test Run ID"
                value={bug.testRun?.id || bug.testRunId || "Unavailable"}
              />
              <InfoCard
                label="Executed By"
                value={
                  getUserName(bug.testRunItem?.executedBy ?? bug.testRun?.triggeredBy ?? null) === "Unknown"
                    ? "Unavailable"
                    : getUserName(bug.testRunItem?.executedBy ?? bug.testRun?.triggeredBy ?? null)
                }
              />
              <InfoCard
                label="Execution Date"
                value={
                  bug.testRunItem?.executedAt
                    ? formatDate(bug.testRunItem.executedAt)
                    : bug.testRun?.finishedAt
                      ? formatDate(bug.testRun.finishedAt)
                      : bug.testRun?.startedAt
                        ? formatDate(bug.testRun.startedAt)
                        : "Unavailable"
                }
              />
              <InfoCard
                label="Related Suite / Plan"
                value={[
                  bug.testRun?.suite?.name || bug.testCase?.suite?.name || null,
                  bug.testRun?.testPlan?.name || null,
                ].filter(Boolean).join(" / ") || "Unavailable"}
              />
            </div>
          </SectionCard>

          <SectionCard title="Description" subtitle="Business and technical summary of the issue.">
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
              {bug.description || "No description provided."}
            </p>
          </SectionCard>

          <SectionCard
            title="Reproduction Steps"
            subtitle="Operational sequence to reproduce the defect quickly."
          >
            {reproductionSteps.length > 0 ? (
              <ol className="space-y-2">
                {reproductionSteps.map((step, index) => (
                  <li
                    key={`${step}-${index}`}
                    className="flex items-start gap-3 rounded-lg border border-stroke bg-surface-muted px-3 py-3"
                  >
                    <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-stroke bg-surface-elevated px-1.5 text-xs font-semibold text-ink">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-ink">{step}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-muted">No reproduction steps provided.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Validation"
            subtitle="Expected behavior versus observed behavior from execution."
            className="border-brand-200/60"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-stroke bg-surface-muted p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-success-500/10 text-success-500">
                    <IconCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-ink">Expected Result</p>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                  {bug.expectedResult || "Expected result not provided."}
                </p>
              </div>
              <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-danger-500/20 text-danger-500">
                    <IconAlert className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-danger-600">Actual Result</p>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                  {bug.actualResult || "Actual result not provided."}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Tags" subtitle="Issue context labels for filtering and reporting.">
            {bug.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {bug.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-stroke bg-surface-muted px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-ink-soft"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No tags added.</p>
            )}
          </SectionCard>
        </div>
      ) : activeTab === "comments" ? (
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
      ) : (
        <div className="space-y-4">
          {attachmentsError ? (
            <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
              {attachmentsError}
            </p>
          ) : null}

          {loadingAttachments ? (
            <p className="text-sm text-ink-muted">Loading attachments...</p>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-ink-muted">No attachments yet.</p>
          ) : (
            <div className="space-y-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {attachment.name || "Unnamed attachment"}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {attachment.type} · {formatSize(attachment.sizeBytes)} · {formatDate(attachment.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewArtifact({
                            url: attachment.url,
                            type: inferAttachmentPreviewType(attachment),
                            mimeType: attachment.mimeType,
                            name: attachment.name,
                          })
                        }
                        className="rounded-md border border-stroke px-2 py-1 text-xs text-ink-muted hover:bg-surface-muted"
                      >
                        Preview
                      </button>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-stroke px-2 py-1 text-xs text-ink-muted hover:bg-surface-muted"
                      >
                        Download
                      </a>
                      {canDeleteAttachment ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-danger-500 transition hover:bg-danger-500/10"
                          aria-label="Delete attachment"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {canUploadAttachments ? (
            <div className="space-y-3 border-t border-stroke pt-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => {
                  const newFiles = Array.from(event.target.files ?? []);
                  setAttachmentFiles((prev) => [...prev, ...newFiles]);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-full rounded-lg border border-dashed border-stroke bg-surface-elevated dark:bg-surface-muted px-4 text-sm text-ink-muted hover:border-brand-300 hover:text-ink transition"
              >
                Browse files&hellip;
              </button>
              {attachmentFiles.length > 0 && (
                <ul className="grid gap-1">
                  {attachmentFiles.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-2 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 py-2 text-sm"
                    >
                      <span className="truncate flex-1 text-ink">{file.name}</span>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {formatSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="shrink-0 ml-1 text-ink-muted hover:text-danger-500 transition"
                      >
                        &times;
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleUploadAttachments}
                  disabled={savingAttachments || attachmentFiles.length === 0}
                >
                  {savingAttachments ? "Uploading..." : "Upload attachments"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <ArtifactPreview
        open={Boolean(previewArtifact)}
        onClose={() => setPreviewArtifact(null)}
        artifact={previewArtifact}
      />
    </Sheet>
  );
}
