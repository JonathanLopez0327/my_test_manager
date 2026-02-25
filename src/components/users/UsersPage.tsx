"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { UserFormSheet } from "./UserFormSheet";
import { UsersHeader } from "./UsersHeader";
import { UsersTable } from "./UsersTable";
import type {
  UserPayload,
  UserRecord,
  UsersResponse,
  UserUpdatePayload,
  UserSortBy,
  SortDir,
} from "./types";
import { nextSort } from "@/lib/sorting";

type OrganizationOption = {
  id: string;
  slug: string;
  name: string;
};

type OrganizationsResponse = {
  items: OrganizationOption[];
};

const DEFAULT_PAGE_SIZE = 10;

export function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<UserRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);

  const canCreate = useMemo(
    () => session?.user?.globalRoles?.includes("super_admin") ?? false,
    [session?.user?.globalRoles],
  );
  const sortBy = (searchParams.get("sortBy") as UserSortBy | null) ?? null;
  const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? null;

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
      if (sortBy && sortDir) {
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);
      }
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
  }, [page, pageSize, query, sortBy, sortDir]);

  const fetchOrganizations = useCallback(async () => {
    if (!canCreate) return;
    try {
      const response = await fetch("/api/organizations");
      const data = (await response.json()) as OrganizationsResponse & {
        message?: string;
      };
      if (response.ok && data.items) {
        setOrganizations(
          data.items.map((o) => ({ id: o.id, slug: o.slug, name: o.name })),
        );
      }
    } catch {
      setOrganizations([]);
    }
  }, [canCreate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

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

  const handleSort = (column: UserSortBy) => {
    const next = nextSort<UserSortBy>(sortBy, sortDir, column);
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

      {canCreate ? (
        <UserFormSheet
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          organizations={organizations}
          user={editing}
        />
      ) : null}
    </div>
  );
}
