"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { BugsHeader } from "./BugsHeader";
import { BugsTable } from "./BugsTable";
import { BugFormSheet } from "./BugFormSheet";
import { BugDetailSheet } from "./BugDetailSheet";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { useCan } from "@/lib/auth/use-can";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import type {
  BugPayload,
  BugRecord,
  BugsResponse,
  BugSortBy,
  SortDir,
} from "./types";
import { nextSort } from "@/lib/sorting";
import { useScreenDataSync } from "@/lib/assistant-hub";
import type { ScreenData } from "@/lib/assistant-hub";

const DEFAULT_PAGE_SIZE = 10;

type ProjectOption = { id: string; key: string; name: string };
type UserOption = { id: string; email: string; fullName: string | null };
type TestRunOption = { id: string; name: string | null; status: string };

function inferAttachmentType(file: File) {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "screenshot";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/") || mime.includes("json") || mime.includes("xml")) return "log";
  return "other";
}

export function BugsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canCreate = useCan(PERMISSIONS.BUG_CREATE);
  const canUpdate = useCan(PERMISSIONS.BUG_UPDATE);
  const canDelete = useCan(PERMISSIONS.BUG_DELETE);
  const canComment = useCan(PERMISSIONS.BUG_COMMENT_CREATE);
  const canDeleteComment = useCan(PERMISSIONS.BUG_COMMENT_DELETE);
  const canListAttachments = useCan(PERMISSIONS.BUG_ATTACHMENT_LIST);
  const canUploadAttachments = useCan(PERMISSIONS.BUG_ATTACHMENT_UPLOAD);
  const canDeleteAttachments = useCan(PERMISSIONS.BUG_ATTACHMENT_DELETE);

  const [items, setItems] = useState<BugRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BugRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewing, setViewing] = useState<BugRecord | null>(null);

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    id: string | null;
    title: string;
    isConfirming: boolean;
  }>({ open: false, id: null, title: "", isConfirming: false });

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [testRuns, setTestRuns] = useState<TestRunOption[]>([]);

  const currentUserId = session?.user?.id;
  const sortBy = (searchParams.get("sortBy") as BugSortBy | null) ?? null;
  const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? null;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const screenData = useMemo<ScreenData>(() => ({
    viewType: "bugsList",
    visibleItems: items.slice(0, 30).map((bug) => ({
      id: bug.id,
      title: bug.title,
      status: bug.status,
      priority: bug.severity,
    })),
    filters: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(severityFilter ? { severity: severityFilter } : {}),
      ...(query ? { search: query } : {}),
    },
    summary: { total, page, pageSize },
  }), [items, statusFilter, severityFilter, query, total, page, pageSize]);

  useScreenDataSync(screenData);

  const fetchBugs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        query,
      });
      if (statusFilter) params.set("status", statusFilter);
      if (severityFilter) params.set("severity", severityFilter);
      if (sortBy && sortDir) {
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);
      }

      const response = await fetch(`/api/bugs?${params.toString()}`);
      const data = (await response.json()) as BugsResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not load bugs.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Could not load bugs.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, statusFilter, severityFilter, sortBy, sortDir]);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects?page=1&pageSize=100");
      if (response.ok) {
        const data = await response.json();
        setProjects(
          (data.items ?? []).map((p: { id: string; key: string; name: string }) => ({
            id: p.id,
            key: p.key,
            name: p.name,
          })),
        );
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users?page=1&pageSize=100");
      if (response.ok) {
        const data = await response.json();
        setUsers(
          (data.items ?? []).map((u: { id: string; email: string; fullName: string | null }) => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName,
          })),
        );
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchTestRuns = useCallback(async () => {
    try {
      const response = await fetch("/api/test-runs?page=1&pageSize=100");
      if (response.ok) {
        const data = await response.json();
        setTestRuns(
          (data.items ?? []).map((r: { id: string; name: string | null; status: string }) => ({
            id: r.id,
            name: r.name,
            status: r.status,
          })),
        );
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchBugs();
  }, [fetchBugs]);

  useEffect(() => {
    fetchProjects();
    fetchUsers();
    fetchTestRuns();
  }, [fetchProjects, fetchUsers, fetchTestRuns]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, statusFilter, severityFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (bug: BugRecord) => {
    setEditing(bug);
    setFormOpen(true);
  };

  const handleView = (bug: BugRecord) => {
    setViewing(bug);
    setDetailOpen(true);
    void fetchBugById(bug.id).then((latestBug) => {
      if (!latestBug) return;
      setViewing((current) => {
        if (!current || current.id !== bug.id) return current;
        return latestBug;
      });
    });
  };

  const handleDelete = (bug: BugRecord) => {
    setDeleteConfirmation({
      open: true,
      id: bug.id,
      title: bug.title,
      isConfirming: false,
    });
  };

  const handleConfirmDelete = async () => {
    const { id } = deleteConfirmation;
    if (!id) return;
    setDeleteConfirmation((prev) => ({ ...prev, isConfirming: true }));
    setError(null);
    try {
      const response = await fetch(`/api/bugs/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not delete bug.");
      }
      await fetchBugs();
      setDeleteConfirmation({ open: false, id: null, title: "", isConfirming: false });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Could not delete bug.",
      );
      setDeleteConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const fetchBugById = useCallback(async (bugId: string) => {
    const response = await fetch(`/api/bugs/${bugId}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as BugRecord;
  }, []);

  const uploadAttachmentsForBug = useCallback(async (bugId: string, files: File[]) => {
    let failed = 0;
    await Promise.all(
      files.map(async (file) => {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("type", inferAttachmentType(file));
        try {
          const response = await fetch(`/api/bugs/${bugId}/attachments/upload`, {
            method: "POST",
            body: formData,
          });
          if (!response.ok) {
            failed += 1;
          }
        } catch {
          failed += 1;
        }
      }),
    );
    return failed;
  }, []);

  const handleSave = async (payload: BugPayload, bugId?: string, files?: File[]) => {
    const method = bugId ? "PUT" : "POST";
    const endpoint = bugId ? `/api/bugs/${bugId}` : "/api/bugs";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as (BugRecord & { message?: string });
    if (!response.ok) {
      throw new Error(data.message || "Could not save bug.");
    }

    if (!bugId && canUploadAttachments && files && files.length > 0) {
      const failedUploads = await uploadAttachmentsForBug(data.id, files);
      if (failedUploads > 0) {
        setError(
          `Bug created, but ${failedUploads} attachment${failedUploads === 1 ? "" : "s"} could not be uploaded.`,
        );
        const latestBug = await fetchBugById(data.id);
        if (latestBug) {
          setViewing(latestBug);
          setDetailOpen(true);
        }
      }
    }

    await fetchBugs();
  };

  const handleSort = (column: BugSortBy) => {
    const next = nextSort<BugSortBy>(sortBy, sortDir, column);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (!next) {
      params.delete("sortBy");
      params.delete("sortDir");
    } else {
      params.set("sortBy", next.sortBy);
      params.set("sortDir", next.sortDir);
    }
    router.replace(`${pathname}?${params.toString()}`);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <BugsHeader
          query={query}
          onQueryChange={setQuery}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          severity={severityFilter}
          onSeverityChange={setSeverityFilter}
          onCreate={handleCreate}
          onRefresh={fetchBugs}
          isRefreshing={loading}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          canCreate={canCreate}
        />

        <div className="mt-5 flex items-center justify-end text-xs text-ink-soft">
          {loading ? "Updating..." : `Total: ${total}`}
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <BugsTable
            items={items}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
            canEdit={canUpdate}
            canDelete={canDelete}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </div>

        <div className="mt-6">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </div>
      </Card>

      <BugFormSheet
        open={formOpen}
        bug={editing}
        projects={projects}
        users={users}
        testRuns={testRuns}
        canUploadAttachments={canUploadAttachments}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      <BugDetailSheet
        open={detailOpen}
        bug={viewing}
        onClose={() => setDetailOpen(false)}
        canComment={canComment}
        canDeleteComment={canDeleteComment}
        canListAttachments={canListAttachments}
        canUploadAttachments={canUploadAttachments}
        canDeleteAttachment={canDeleteAttachments}
        currentUserId={currentUserId}
      />

      <ConfirmationDialog
        open={deleteConfirmation.open}
        title={`Delete bug "${deleteConfirmation.title}"?`}
        description="This action will permanently delete the bug and all its comments. This cannot be undone."
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() =>
          setDeleteConfirmation({ open: false, id: null, title: "", isConfirming: false })
        }
        isConfirming={deleteConfirmation.isConfirming}
      />
    </div>
  );
}

