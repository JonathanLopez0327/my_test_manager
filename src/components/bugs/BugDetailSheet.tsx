"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ArtifactPreview } from "../ui/ArtifactPreview";
import { IconTrash } from "../icons";
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
    <Sheet open={open} title={bug.title} description={`${bug.project.key} · ${bug.project.name}`} onClose={onClose} width="2xl">
      <div className="mb-4 flex items-center justify-end">
        <AssistantHubTrigger
          context={{ type: "bug", bugId: bug.id, bugTitle: bug.title, projectId: bug.projectId }}
          label="Ask AI"
          variant="button"
        />
      </div>
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
            {bug.testRun ? (
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Linked Test Run</p>
                <p className="mt-1 text-sm text-ink">{bug.testRun.name || bug.testRun.id}</p>
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
