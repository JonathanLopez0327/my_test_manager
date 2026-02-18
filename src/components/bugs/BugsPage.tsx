"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { BugsHeader } from "./BugsHeader";
import { BugsTable } from "./BugsTable";
import { BugFormSheet } from "./BugFormSheet";
import { BugDetailSheet } from "./BugDetailSheet";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { useCan } from "@/lib/auth/use-can";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import type { BugPayload, BugRecord, BugsResponse } from "./types";

const DEFAULT_PAGE_SIZE = 10;

type ProjectOption = { id: string; key: string; name: string };
type UserOption = { id: string; email: string; fullName: string | null };

export function BugsPage() {
  const { data: session } = useSession();
  const canCreate = useCan(PERMISSIONS.BUG_CREATE);
  const canUpdate = useCan(PERMISSIONS.BUG_UPDATE);
  const canDelete = useCan(PERMISSIONS.BUG_DELETE);
  const canComment = useCan(PERMISSIONS.BUG_COMMENT_CREATE);
  const canDeleteComment = useCan(PERMISSIONS.BUG_COMMENT_DELETE);

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

  const currentUserId = session?.user?.id;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

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
  }, [page, pageSize, query, statusFilter, severityFilter]);

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

  useEffect(() => {
    fetchBugs();
  }, [fetchBugs]);

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, [fetchProjects, fetchUsers]);

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

  const handleSave = async (payload: BugPayload, bugId?: string) => {
    const method = bugId ? "PUT" : "POST";
    const endpoint = bugId ? `/api/bugs/${bugId}` : "/api/bugs";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message || "Could not save bug.");
    }
    await fetchBugs();
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
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          canCreate={canCreate}
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Bugs List</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            {loading ? "Updating..." : `Total: ${total}`}
          </div>
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
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      <BugDetailSheet
        open={detailOpen}
        bug={viewing}
        onClose={() => setDetailOpen(false)}
        canComment={canComment}
        canDeleteComment={canDeleteComment}
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
