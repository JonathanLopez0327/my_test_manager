"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { UserFormModal } from "./UserFormModal";
import { UsersHeader } from "./UsersHeader";
import { UsersTable } from "./UsersTable";
import type {
  UserPayload,
  UserRecord,
  UsersResponse,
  UserUpdatePayload,
} from "./types";

type ProjectOption = {
  id: string;
  key: string;
  name: string;
};

type ProjectsResponse = {
  items: ProjectOption[];
};

const DEFAULT_PAGE_SIZE = 10;

export function UsersPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<UserRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const canCreate = useMemo(
    () => session?.user?.globalRoles?.includes("super_admin") ?? false,
    [session?.user?.globalRoles],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        query,
      });
      const response = await fetch(`/api/users?${params.toString()}`);
      const data = (await response.json()) as UsersResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los usuarios.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar los usuarios.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query]);

  const fetchProjects = useCallback(async () => {
    if (!canCreate) return;
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
      });
      const response = await fetch(`/api/projects?${params.toString()}`);
      const data = (await response.json()) as ProjectsResponse & {
        message?: string;
      };
      if (response.ok && data.items) {
        setProjects(data.items);
      }
    } catch {
      setProjects([]);
    }
  }, [canCreate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleCreate = () => {
    if (!canCreate) return;
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (user: UserRecord) => {
    if (!canCreate) return;
    setEditing(user);
    setModalOpen(true);
  };

  const handleSave = async (
    payload: UserPayload | UserUpdatePayload,
    userId?: string,
  ) => {
    const isEditing = Boolean(userId);
    const endpoint = isEditing ? `/api/users/${userId}` : "/api/users";
    const method = isEditing ? "PUT" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(
        data.message ||
          (isEditing
            ? "No se pudo actualizar el usuario."
            : "No se pudo crear el usuario."),
      );
    }
    await fetchUsers();
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <UsersHeader
          query={query}
          onQueryChange={setQuery}
          onCreate={handleCreate}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          canCreate={canCreate}
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Listado de usuarios</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            {loading ? "Actualizando..." : `Total: ${total}`}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
        <UsersTable
          items={items}
          loading={loading}
          onEdit={handleEdit}
          canManage={canCreate}
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

      {canCreate ? (
        <UserFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          projects={projects}
          user={editing}
        />
      ) : null}
    </div>
  );
}
