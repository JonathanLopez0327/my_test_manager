"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown, IconEdit, IconFolder, IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { TestCasesTable } from "@/components/test-cases/TestCasesTable";
import { TestCaseDetailSheet } from "@/components/test-cases/TestCaseDetailSheet";
import { TestCaseFormSheet } from "@/components/test-cases/TestCaseFormSheet";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { TestPlanFormSheet } from "@/components/test-plans/TestPlanFormSheet";
import { TestManagementCasesHeader } from "./TestManagementCasesHeader";
import type {
  TestPlanPayload,
  TestPlansResponse,
  TestPlanRecord,
} from "@/components/test-plans/types";
import type { TestSuitesResponse, TestSuiteRecord } from "@/components/test-suites/types";
import type { TestSuitePayload } from "@/components/test-suites/types";
import type { ProjectsResponse } from "@/components/projects/types";
import type {
  TestCasePayload,
  TestCaseRecord,
  TestCasesResponse,
  TestCaseStatus,
  TestCaseTagsResponse,
  TestCaseSortBy,
  SortDir,
} from "@/components/test-cases/types";
import { nextSort } from "@/lib/sorting";
import { cn } from "@/lib/utils";
import { useScreenDataSync } from "@/lib/assistant-hub";
import type { ScreenData } from "@/lib/assistant-hub";

const DEFAULT_PAGE_SIZE = 10;
const LIST_PAGE_SIZE = 50;

type SuiteTreeNode = TestSuiteRecord & {
  children: SuiteTreeNode[];
};

type SuiteOption = {
  id: string;
  name: string;
  testPlanName: string;
  projectKey: string;
  projectName: string;
};

type ProjectOption = {
  id: string;
  key: string;
  name: string;
};

function sortSuites(left: TestSuiteRecord, right: TestSuiteRecord) {
  if (left.displayOrder !== right.displayOrder) {
    return left.displayOrder - right.displayOrder;
  }
  return left.name.localeCompare(right.name);
}

function buildSuiteTree(suites: TestSuiteRecord[]): SuiteTreeNode[] {
  const nodeMap = new Map<string, SuiteTreeNode>();
  for (const suite of suites) {
    nodeMap.set(suite.id, { ...suite, children: [] });
  }

  const roots: SuiteTreeNode[] = [];
  for (const suite of suites) {
    const node = nodeMap.get(suite.id);
    if (!node) continue;
    if (suite.parentSuiteId) {
      const parent = nodeMap.get(suite.parentSuiteId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  const sortRecursively = (nodes: SuiteTreeNode[]) => {
    nodes.sort(sortSuites);
    nodes.forEach((child) => sortRecursively(child.children));
  };

  sortRecursively(roots);
  return roots;
}

function getSuiteDescendantIds(
  suiteId: string,
  childrenByParent: Map<string, string[]>,
): Set<string> {
  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(suiteId) ?? [])];
  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || descendants.has(currentId)) continue;
    descendants.add(currentId);
    const children = childrenByParent.get(currentId) ?? [];
    for (const childId of children) stack.push(childId);
  }
  return descendants;
}

export function TestManagementWorkspace() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [plans, setPlans] = useState<TestPlanRecord[]>([]);
  const [suites, setSuites] = useState<TestSuiteRecord[]>([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);

  const [expandedPlanIds, setExpandedPlanIds] = useState<Record<string, boolean>>({});
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>("");

  const [items, setItems] = useState<TestCaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TestCaseStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TestCaseRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDetailCase, setSelectedDetailCase] = useState<TestCaseRecord | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TestPlanRecord | null>(null);
  const [inlinePlanId, setInlinePlanId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isInlineSaving, setIsInlineSaving] = useState(false);
  const [editingSuiteId, setEditingSuiteId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingError, setEditingError] = useState<{ suiteId: string; message: string } | null>(
    null,
  );
  const [isInlineEditingSaving, setIsInlineEditingSaving] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [planSaveError, setPlanSaveError] = useState<string | null>(null);
  const [suiteSaveError, setSuiteSaveError] = useState<string | null>(null);
  const [draggingSuiteId, setDraggingSuiteId] = useState<string | null>(null);
  const [dropTargetSuiteId, setDropTargetSuiteId] = useState<string | null>(null);
  const [dropTargetPlanId, setDropTargetPlanId] = useState<string | null>(null);
  const [movingSuiteId, setMovingSuiteId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    id: string | null;
    title: string;
    isConfirming: boolean;
  }>({ open: false, id: null, title: "", isConfirming: false });
  const [duplicateConfirmation, setDuplicateConfirmation] = useState<{
    open: boolean;
    id: string | null;
    title: string;
    isConfirming: boolean;
  }>({ open: false, id: null, title: "", isConfirming: false });

  const sortBy = (searchParams.get("sortBy") as TestCaseSortBy | null) ?? null;
  const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? null;

  const isReadOnlyGlobal = useMemo(
    () =>
      session?.user?.globalRoles?.some(
        (role) => role === "support" || role === "auditor",
      ) ?? false,
    [session?.user?.globalRoles],
  );
  const canManage = !isReadOnlyGlobal;

  const suitesByPlan = useMemo(() => {
    return plans.reduce<Record<string, SuiteTreeNode[]>>((acc, plan) => {
      const planSuites = suites.filter((suite) => suite.testPlanId === plan.id);
      acc[plan.id] = buildSuiteTree(planSuites);
      return acc;
    }, {});
  }, [plans, suites]);

  const suiteOptions = useMemo<SuiteOption[]>(
    () =>
      suites.map((suite) => ({
        id: suite.id,
        name: suite.name,
        testPlanName: suite.testPlan.name,
        projectKey: suite.testPlan.project.key,
        projectName: suite.testPlan.project.name,
      })),
    [suites],
  );
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );
  const selectedSuite = useMemo(
    () => suites.find((suite) => suite.id === selectedSuiteId) ?? null,
    [suites, selectedSuiteId],
  );
  const suiteById = useMemo(
    () => new Map(suites.map((suite) => [suite.id, suite])),
    [suites],
  );
  const descendantIdsBySuiteId = useMemo(() => {
    const childrenByParent = new Map<string, string[]>();
    for (const suite of suites) {
      if (!suite.parentSuiteId) continue;
      const siblings = childrenByParent.get(suite.parentSuiteId) ?? [];
      siblings.push(suite.id);
      childrenByParent.set(suite.parentSuiteId, siblings);
    }
    const descendants = new Map<string, Set<string>>();
    for (const suite of suites) {
      descendants.set(suite.id, getSuiteDescendantIds(suite.id, childrenByParent));
    }
    return descendants;
  }, [suites]);
  const isInlineCreating = inlinePlanId !== null;

  const screenData = useMemo<ScreenData>(() => ({
    viewType: "testManagement",
    visibleItems: items.slice(0, 30).map((tc) => ({
      id: tc.id,
      title: tc.title,
      status: tc.status,
      priority: tc.priority != null ? String(tc.priority) : undefined,
    })),
    filters: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(priorityFilter ? { priority: priorityFilter } : {}),
      ...(tagFilter ? { tag: tagFilter } : {}),
      ...(query ? { search: query } : {}),
    },
    summary: { total, page, pageSize },
    breadcrumb: [
      ...(selectedPlan ? [selectedPlan.name] : []),
      ...(selectedSuite ? [selectedSuite.name] : []),
    ],
  }), [items, statusFilter, priorityFilter, tagFilter, query, total, page, pageSize, selectedPlan, selectedSuite]);

  useScreenDataSync(screenData);

  const fetchAllPlansAndSuites = useCallback(async () => {
    setLoadingHierarchy(true);
    setHierarchyError(null);
    try {
      const allPlans: TestPlanRecord[] = [];
      const allSuites: TestSuiteRecord[] = [];

      let pageCursor = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({
          page: String(pageCursor),
          pageSize: String(LIST_PAGE_SIZE),
          query: "",
        });
        const response = await fetch(`/api/test-plans?${params.toString()}`);
        const payload = (await response.json()) as TestPlansResponse & { message?: string };
        if (!response.ok) {
          throw new Error(payload.message || "Could not load test plans.");
        }
        allPlans.push(...payload.items);
        hasMore = pageCursor * payload.pageSize < payload.total;
        pageCursor += 1;
      }

      pageCursor = 1;
      hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({
          page: String(pageCursor),
          pageSize: String(LIST_PAGE_SIZE),
          query: "",
        });
        const response = await fetch(`/api/test-suites?${params.toString()}`);
        const payload = (await response.json()) as TestSuitesResponse & { message?: string };
        if (!response.ok) {
          throw new Error(payload.message || "Could not load test suites.");
        }
        allSuites.push(...payload.items);
        hasMore = pageCursor * payload.pageSize < payload.total;
        pageCursor += 1;
      }

      setPlans(allPlans);
      setSuites(allSuites);
      setExpandedPlanIds((prev) => {
        const next = { ...prev };
        allPlans.forEach((plan) => {
          if (!(plan.id in next)) next[plan.id] = true;
        });
        return next;
      });
    } catch (fetchError) {
      setHierarchyError(
        fetchError instanceof Error ? fetchError.message : "Could not load hierarchy.",
      );
    } finally {
      setLoadingHierarchy(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    setProjectsError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        query: "",
      });
      const response = await fetch(`/api/projects?${params.toString()}`);
      const payload = (await response.json()) as ProjectsResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || "Could not load projects.");
      }
      setProjects(
        payload.items.map((project) => ({
          id: project.id,
          key: project.key,
          name: project.name,
        })),
      );
    } catch (fetchError) {
      setProjectsError(
        fetchError instanceof Error ? fetchError.message : "Could not load projects.",
      );
    }
  }, []);

  useEffect(() => {
    void fetchAllPlansAndSuites();
    void fetchProjects();
  }, [fetchAllPlansAndSuites, fetchProjects]);

  useEffect(() => {
    if (!plans.length) {
      setSelectedPlanId(null);
      setSelectedSuiteId("");
      return;
    }

    setSelectedPlanId((current) => {
      if (current && plans.some((plan) => plan.id === current)) return current;
      return plans[0].id;
    });
    setSelectedSuiteId((current) =>
      current && suites.some((suite) => suite.id === current) ? current : "",
    );
  }, [plans, suites]);

  useEffect(() => {
    setTagFilter("");
    setPage(1);
  }, [selectedSuiteId]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, tagFilter, statusFilter, priorityFilter]);

  const fetchCases = useCallback(async () => {
    if (!selectedSuiteId) {
      setItems([]);
      setTotal(0);
      return;
    }

    setLoadingCases(true);
    setCasesError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        query,
        suiteId: selectedSuiteId,
      });

      if (tagFilter) {
        params.set("tag", tagFilter);
      }
      if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (priorityFilter) {
        params.set("priority", priorityFilter);
      }
      if (sortBy && sortDir) {
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);
      }

      const response = await fetch(`/api/test-cases?${params.toString()}`);
      const data = (await response.json()) as TestCasesResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not load test cases.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setCasesError(
        fetchError instanceof Error ? fetchError.message : "Could not load test cases.",
      );
    } finally {
      setLoadingCases(false);
    }
  }, [selectedSuiteId, page, pageSize, query, tagFilter, statusFilter, priorityFilter, sortBy, sortDir]);

  const fetchTags = useCallback(async () => {
    if (!selectedSuiteId) {
      setTags([]);
      setTagsError(null);
      return;
    }

    setTagsError(null);
    try {
      const params = new URLSearchParams({ suiteId: selectedSuiteId });
      const response = await fetch(`/api/test-cases/tags?${params.toString()}`);
      const data = (await response.json()) as TestCaseTagsResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not load tags.");
      }
      setTags(data.items);
    } catch (fetchError) {
      setTagsError(fetchError instanceof Error ? fetchError.message : "Could not load tags.");
    }
  }, [selectedSuiteId]);

  useEffect(() => {
    void fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const handleSort = (column: TestCaseSortBy) => {
    const next = nextSort<TestCaseSortBy>(sortBy, sortDir, column);
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

  const handleCreate = () => {
    if (!canManage || !selectedSuiteId) return;
    setEditing(null);
    setModalOpen(true);
  };

  const handleCreatePlan = () => {
    if (!canManage) return;
    setPlanSaveError(null);
    setEditingPlan(null);
    setPlanModalOpen(true);
  };

  const handleEditPlan = (plan: TestPlanRecord) => {
    if (!canManage) return;
    setPlanSaveError(null);
    setEditingPlan(plan);
    setPlanModalOpen(true);
  };

  const handleEdit = (testCase: TestCaseRecord) => {
    if (!canManage) return;
    setEditing(testCase);
    setModalOpen(true);
  };

  const handleView = (testCase: TestCaseRecord) => {
    setSelectedDetailCase(testCase);
    setIsDetailOpen(true);
  };

  const handleDelete = (testCase: TestCaseRecord) => {
    if (!canManage) return;
    setDeleteConfirmation({
      open: true,
      id: testCase.id,
      title: testCase.title,
      isConfirming: false,
    });
  };

  const handleDuplicate = (testCase: TestCaseRecord) => {
    if (!canManage) return;
    setDuplicateConfirmation({
      open: true,
      id: testCase.id,
      title: testCase.title,
      isConfirming: false,
    });
  };

  const handleConfirmDuplicate = async () => {
    const { id } = duplicateConfirmation;
    if (!id) return;

    setDuplicateConfirmation((prev) => ({ ...prev, isConfirming: true }));
    setCasesError(null);
    try {
      const response = await fetch(`/api/test-cases/${id}/duplicate`, {
        method: "POST",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not duplicate test case.");
      }
      await fetchCases();
      setDuplicateConfirmation({ open: false, id: null, title: "", isConfirming: false });
    } catch (dupError) {
      setCasesError(
        dupError instanceof Error ? dupError.message : "Could not duplicate test case.",
      );
      setDuplicateConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const handleConfirmDelete = async () => {
    const { id } = deleteConfirmation;
    if (!id) return;

    setDeleteConfirmation((prev) => ({ ...prev, isConfirming: true }));
    setCasesError(null);
    try {
      const response = await fetch(`/api/test-cases/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not delete test case.");
      }
      await fetchCases();
      setDeleteConfirmation({ open: false, id: null, title: "", isConfirming: false });
    } catch (deleteError) {
      setCasesError(
        deleteError instanceof Error ? deleteError.message : "Could not delete test case.",
      );
      setDeleteConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const handleSave = async (payload: TestCasePayload, testCaseId?: string) => {
    const method = testCaseId ? "PUT" : "POST";
    const endpoint = testCaseId ? `/api/test-cases/${testCaseId}` : "/api/test-cases";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message || "Could not save test case.");
    }
    await fetchCases();
  };

  const handleSavePlan = async (payload: TestPlanPayload, planId?: string) => {
    setPlanSaveError(null);
    const method = planId ? "PUT" : "POST";
    const endpoint = planId ? `/api/test-plans/${planId}` : "/api/test-plans";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { message?: string; item?: TestPlanRecord };
    if (!response.ok) {
      const message = data.message || "Could not save test plan.";
      setPlanSaveError(message);
      throw new Error(message);
    }

    await fetchAllPlansAndSuites();
    const createdPlanId = data.item?.id;
    if (createdPlanId) {
      setSelectedPlanId(createdPlanId);
      setExpandedPlanIds((prev) => ({ ...prev, [createdPlanId]: true }));
    }
  };

  const handleDeletePlan = async (plan: TestPlanRecord) => {
    setPlanSaveError(null);
    const response = await fetch(`/api/test-plans/${plan.id}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      const message = data.message || "Could not delete test plan.";
      setPlanSaveError(message);
      throw new Error(message);
    }

    await fetchAllPlansAndSuites();
    setSelectedSuiteId((current) => {
      const belongsToDeletedPlan = suites.some(
        (suite) => suite.id === current && suite.testPlanId === plan.id,
      );
      return belongsToDeletedPlan ? "" : current;
    });
  };

  const handleSaveSuite = useCallback(
    async (payload: TestSuitePayload, suiteId?: string) => {
      setSuiteSaveError(null);
      const method = suiteId ? "PUT" : "POST";
      const endpoint = suiteId ? `/api/test-suites/${suiteId}` : "/api/test-suites";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as
        | { message?: string; item?: TestSuiteRecord }
        | (TestSuiteRecord & { message?: string });
      if (!response.ok) {
        const message = data.message ?? "Could not save test suite.";
        setSuiteSaveError(message);
        throw new Error(message);
      }

      await fetchAllPlansAndSuites();
      const createdSuite = "item" in data ? data.item : data;
      if (createdSuite) {
        setSelectedPlanId(createdSuite.testPlanId);
        setSelectedSuiteId(createdSuite.id);
        setExpandedPlanIds((prev) => ({ ...prev, [createdSuite.testPlanId]: true }));
      }
    },
    [fetchAllPlansAndSuites],
  );

  const resolveInlineParentSuiteId = useCallback((_planId: string): string | null => {
    return null;
  }, []);

  const resetInlineCreateState = useCallback(() => {
    setInlinePlanId(null);
    setInlineDraft("");
    setInlineError(null);
  }, []);

  const resetInlineEditState = useCallback(() => {
    setEditingSuiteId(null);
    setEditingValue("");
  }, []);

  const handleStartInlineCreate = (planId: string) => {
    if (!canManage) return;
    if (isInlineSaving || isInlineEditingSaving) return;
    resetInlineEditState();
    setEditingError(null);
    setSuiteSaveError(null);
    setInlineError(null);
    setSelectedPlanId(planId);
    setExpandedPlanIds((prev) => ({ ...prev, [planId]: true }));
    setInlinePlanId(planId);
    setInlineDraft("");
  };

  const handleInlineCreateSubmit = useCallback(
    async (planId: string, draft: string) => {
      const name = draft.trim();
      if (!name) {
        resetInlineCreateState();
        return;
      }

      setIsInlineSaving(true);
      setInlineError(null);
      setSuiteSaveError(null);
      try {
        await handleSaveSuite({
          testPlanId: planId,
          parentSuiteId: resolveInlineParentSuiteId(planId),
          name,
          description: null,
          displayOrder: 0,
        });
        resetInlineCreateState();
      } catch (saveError) {
        setInlineError(
          saveError instanceof Error ? saveError.message : "Could not save test suite.",
        );
        setSuiteSaveError(null);
      } finally {
        setIsInlineSaving(false);
      }
    },
    [handleSaveSuite, resetInlineCreateState, resolveInlineParentSuiteId],
  );

  const handleStartInlineEdit = useCallback(
    (suite: TestSuiteRecord, planId: string) => {
      if (!canManage) return;
      if (isInlineSaving || isInlineEditingSaving) return;
      resetInlineCreateState();
      setInlineError(null);
      setEditingError(null);
      setSelectedPlanId(planId);
      setSelectedSuiteId(suite.id);
      setExpandedPlanIds((prev) => ({ ...prev, [planId]: true }));
      setEditingSuiteId(suite.id);
      setEditingValue(suite.name);
    },
    [canManage, isInlineEditingSaving, isInlineSaving, resetInlineCreateState],
  );

  const handleInlineEditSubmit = useCallback(
    async (suite: TestSuiteRecord, value: string) => {
      const trimmedName = value.trim();
      if (!trimmedName || trimmedName === suite.name) {
        resetInlineEditState();
        return;
      }

      setIsInlineEditingSaving(true);
      setEditingError(null);
      setSuiteSaveError(null);

      try {
        await handleSaveSuite(
          {
            testPlanId: suite.testPlanId,
            parentSuiteId: suite.parentSuiteId,
            name: trimmedName,
            description: suite.description,
            displayOrder: suite.displayOrder,
          },
          suite.id,
        );
        resetInlineEditState();
      } catch (saveError) {
        setEditingError({
          suiteId: suite.id,
          message: saveError instanceof Error ? saveError.message : "Could not update test suite.",
        });
        setSuiteSaveError(null);
        resetInlineEditState();
      } finally {
        setIsInlineEditingSaving(false);
      }
    },
    [handleSaveSuite, resetInlineEditState],
  );

  const getDropValidationMessage = useCallback(
    (sourceSuiteId: string | null, targetSuiteId: string): string | null => {
      if (!sourceSuiteId) return "No suite is being moved.";
      if (sourceSuiteId === targetSuiteId) return "A suite cannot be dropped onto itself.";
      const sourceSuite = suiteById.get(sourceSuiteId);
      const targetSuite = suiteById.get(targetSuiteId);
      if (!sourceSuite || !targetSuite) return "Could not resolve source or target suite.";
      if (sourceSuite.testPlanId !== targetSuite.testPlanId) {
        return "Suites can only be nested within the same test plan.";
      }
      if (sourceSuite.parentSuiteId === targetSuite.id) return "Suite is already nested under the target.";
      if (descendantIdsBySuiteId.get(sourceSuite.id)?.has(targetSuite.id)) {
        return "You cannot move a suite into one of its descendants.";
      }
      return null;
    },
    [descendantIdsBySuiteId, suiteById],
  );

  const handleDropOnSuite = useCallback(
    async (targetSuiteId: string) => {
      if (!canManage || isInlineSaving || isInlineEditingSaving) return;

      const sourceSuiteId = draggingSuiteId;
      const validationMessage = getDropValidationMessage(sourceSuiteId, targetSuiteId);
      if (validationMessage) {
        if (validationMessage !== "Suite is already nested under the target.") {
          setSuiteSaveError(validationMessage);
        } else {
          setSuiteSaveError(null);
        }
        return;
      }

      if (!sourceSuiteId) return;
      const sourceSuite = suiteById.get(sourceSuiteId);
      const targetSuite = suiteById.get(targetSuiteId);
      if (!sourceSuite || !targetSuite) {
        setSuiteSaveError("Could not resolve source or target suite.");
        return;
      }

      setSuiteSaveError(null);
      setMovingSuiteId(sourceSuiteId);
      try {
        await handleSaveSuite(
          {
            testPlanId: sourceSuite.testPlanId,
            parentSuiteId: targetSuite.id,
            name: sourceSuite.name,
            description: sourceSuite.description,
            displayOrder: sourceSuite.displayOrder,
          },
          sourceSuite.id,
        );
      } catch (moveError) {
        setSuiteSaveError(moveError instanceof Error ? moveError.message : "Could not move test suite.");
      } finally {
        setMovingSuiteId(null);
      }
    },
    [
      canManage,
      draggingSuiteId,
      getDropValidationMessage,
      handleSaveSuite,
      isInlineEditingSaving,
      isInlineSaving,
      suiteById,
    ],
  );

  const getRootDropValidationMessage = useCallback(
    (sourceSuiteId: string | null, targetPlanId: string): string | null => {
      if (!sourceSuiteId) return "No suite is being moved.";
      const sourceSuite = suiteById.get(sourceSuiteId);
      if (!sourceSuite) return "Could not resolve source suite.";
      if (sourceSuite.testPlanId !== targetPlanId) {
        return "Suites can only be moved to root within the same test plan.";
      }
      if (sourceSuite.parentSuiteId === null) return "Suite is already at root level.";
      return null;
    },
    [suiteById],
  );

  const handleDropToPlanRoot = useCallback(
    async (targetPlanId: string) => {
      if (!canManage || isInlineSaving || isInlineEditingSaving) return;

      const sourceSuiteId = draggingSuiteId;
      const validationMessage = getRootDropValidationMessage(sourceSuiteId, targetPlanId);
      if (validationMessage) {
        if (validationMessage !== "Suite is already at root level.") {
          setSuiteSaveError(validationMessage);
        } else {
          setSuiteSaveError(null);
        }
        return;
      }

      if (!sourceSuiteId) return;
      const sourceSuite = suiteById.get(sourceSuiteId);
      if (!sourceSuite) {
        setSuiteSaveError("Could not resolve source suite.");
        return;
      }

      setSuiteSaveError(null);
      setMovingSuiteId(sourceSuiteId);
      try {
        await handleSaveSuite(
          {
            testPlanId: sourceSuite.testPlanId,
            parentSuiteId: null,
            name: sourceSuite.name,
            description: sourceSuite.description,
            displayOrder: sourceSuite.displayOrder,
          },
          sourceSuite.id,
        );
      } catch (moveError) {
        setSuiteSaveError(moveError instanceof Error ? moveError.message : "Could not move test suite.");
      } finally {
        setMovingSuiteId(null);
      }
    },
    [
      canManage,
      draggingSuiteId,
      getRootDropValidationMessage,
      handleSaveSuite,
      isInlineEditingSaving,
      isInlineSaving,
      suiteById,
    ],
  );

  const buildExportUrl = useCallback((format: "xlsx" | "pdf") => {
    const params = new URLSearchParams();
    params.set("format", format);
    if (query.trim()) params.set("query", query.trim());
    if (selectedSuiteId) params.set("suiteId", selectedSuiteId);
    if (tagFilter) params.set("tag", tagFilter);
    if (sortBy && sortDir) {
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
    }
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    return `/api/test-cases/export?${params.toString()}`;
  }, [query, selectedSuiteId, tagFilter, statusFilter, priorityFilter, sortBy, sortDir]);

  const handleExportExcel = () => {
    if (!selectedSuiteId) return;
    window.open(buildExportUrl("xlsx"), "_blank", "noopener,noreferrer");
  };

  const handleExportPdf = () => {
    if (!selectedSuiteId) return;
    window.open(buildExportUrl("pdf"), "_blank", "noopener,noreferrer");
  };

  const renderSuiteNodes = (nodes: SuiteTreeNode[], depth: number, planId: string) =>
    nodes.map((suite) => {
      const isSelected = selectedSuiteId === suite.id;
      const isEditingThisSuite = editingSuiteId === suite.id;
      const isDropTarget = dropTargetSuiteId === suite.id;
      const dropValidationMessage = getDropValidationMessage(draggingSuiteId, suite.id);
      const canAcceptDrop = draggingSuiteId !== null && dropValidationMessage === null;
      const isDraggingThisSuite = draggingSuiteId === suite.id;
      const isMovingThisSuite = movingSuiteId === suite.id;
      return (
        <div key={suite.id}>
          {isEditingThisSuite ? (
            <div style={{ paddingLeft: `${12 + depth * 18}px` }}>
              <input
                autoFocus
                value={editingValue}
                onChange={(event) => {
                  setEditingValue(event.target.value);
                  if (editingError?.suiteId === suite.id) setEditingError(null);
                }}
                onFocus={(event) => event.currentTarget.select()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (!isInlineEditingSaving) {
                      void handleInlineEditSubmit(suite, editingValue);
                    }
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    if (!isInlineEditingSaving) {
                      resetInlineEditState();
                    }
                  }
                }}
                onBlur={() => {
                  if (!isEditingThisSuite || isInlineEditingSaving) return;
                  const trimmed = editingValue.trim();
                  if (!trimmed) {
                    resetInlineEditState();
                    return;
                  }
                  void handleInlineEditSubmit(suite, editingValue);
                }}
                disabled={isInlineEditingSaving}
                aria-label="Edit suite name"
                className="h-9 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-70"
              />
            </div>
          ) : (
            <button
              type="button"
              draggable={canManage && !isInlineSaving && !isInlineEditingSaving}
              onClick={() => {
                if (isInlineEditingSaving || isMovingThisSuite) return;
                setSelectedPlanId(planId);
                setSelectedSuiteId(suite.id);
              }}
              onDoubleClick={() => handleStartInlineEdit(suite, planId)}
              onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                if (!canManage || isInlineSaving || isInlineEditingSaving || movingSuiteId !== null) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", suite.id);
                setSuiteSaveError(null);
                setDraggingSuiteId(suite.id);
                setDropTargetSuiteId(null);
                setDropTargetPlanId(null);
              }}
              onDragEnd={() => {
                setDraggingSuiteId(null);
                setDropTargetSuiteId(null);
                setDropTargetPlanId(null);
              }}
              onDragOver={(event: DragEvent<HTMLButtonElement>) => {
                if (!draggingSuiteId) return;
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = canAcceptDrop ? "move" : "none";
                setDropTargetSuiteId(suite.id);
                setDropTargetPlanId(null);
              }}
              onDragLeave={(event: DragEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                if (dropTargetSuiteId === suite.id) {
                  setDropTargetSuiteId(null);
                }
              }}
              onDrop={(event: DragEvent<HTMLButtonElement>) => {
                event.preventDefault();
                event.stopPropagation();
                void handleDropOnSuite(suite.id);
                setDraggingSuiteId(null);
                setDropTargetSuiteId(null);
                setDropTargetPlanId(null);
              }}
              aria-label={suite.name}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors",
                isSelected
                  ? "bg-brand-50/70 font-semibold text-brand-700"
                  : "text-ink-muted hover:bg-brand-50/40 hover:text-ink",
                isDraggingThisSuite ? "opacity-60" : "",
                isDropTarget && canAcceptDrop ? "ring-2 ring-brand-300 bg-brand-50/60" : "",
                isDropTarget && !canAcceptDrop ? "ring-2 ring-danger-300 bg-danger-500/10" : "",
                canManage ? "cursor-grab active:cursor-grabbing" : "",
              )}
              style={{ paddingLeft: `${12 + depth * 18}px` }}
            >
              {suite.name}
            </button>
          )}
          {editingError?.suiteId === suite.id ? (
            <p
              className="mt-1 px-3 text-xs text-danger-500"
              style={{ paddingLeft: `${12 + depth * 18}px` }}
            >
              {editingError.message}
            </p>
          ) : null}
          {suite.children.length > 0 ? renderSuiteNodes(suite.children, depth + 1, planId) : null}
        </div>
      );
    });

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      <aside className="flex w-[400px] shrink-0 flex-col border-r border-stroke bg-surface/50">
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Test Workspace</h2>
            <p className="text-xs text-ink-muted">
              {loadingHierarchy ? "Loading hierarchy..." : `${plans.length} plans · ${suites.length} suites`}
            </p>
          </div>
          {canManage ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 w-9 rounded-xl border-brand-300 bg-brand-50 p-0 text-brand-700 hover:bg-brand-100"
              onClick={handleCreatePlan}
              aria-label="Create test plan"
            >
              <IconPlus className="h-5 w-5 shrink-0 text-brand-700" />
            </Button>
          ) : null}
        </div>

        {hierarchyError ? (
          <div className="mx-4 mb-4 rounded-lg border border-danger-500/20 bg-danger-500/10 px-3 py-2.5 text-sm text-danger-600">
            <div className="flex items-center justify-between gap-3">
              <span>{hierarchyError}</span>
              <Button size="xs" variant="critical" onClick={() => void fetchAllPlansAndSuites()}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}
        {projectsError ? (
          <div className="mx-4 mb-4 rounded-lg border border-warning-500/20 bg-warning-500/10 px-3 py-2.5 text-sm text-warning-500">
            <div className="flex items-center justify-between gap-3">
              <span>{projectsError}</span>
              <Button size="xs" variant="soft" onClick={() => void fetchProjects()}>
                Reload projects
              </Button>
            </div>
          </div>
        ) : null}
        {planSaveError ? (
          <div className="mx-4 mb-4 rounded-lg border border-danger-500/20 bg-danger-500/10 px-3 py-2.5 text-sm text-danger-600">
            {planSaveError}
          </div>
        ) : null}
        {suiteSaveError ? (
          <div className="mx-4 mb-4 rounded-lg border border-danger-500/20 bg-danger-500/10 px-3 py-2.5 text-sm text-danger-600">
            {suiteSaveError}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {!loadingHierarchy && plans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stroke-strong bg-surface-muted/50 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-ink">No test plans found.</p>
              <p className="mt-1 text-xs text-ink-muted">Create test plans and suites to populate the workspace.</p>
            </div>
          ) : null}

          <div className="space-y-2">
            {plans.map((plan) => {
              const isOpen = expandedPlanIds[plan.id] ?? false;
              const isPlanSelected = selectedPlanId === plan.id;
              const rootDropValidationMessage = getRootDropValidationMessage(draggingSuiteId, plan.id);
              const canAcceptRootDrop = draggingSuiteId !== null && rootDropValidationMessage === null;
              const isPlanRootDropTarget = dropTargetPlanId === plan.id;
              return (
                <div key={plan.id} className="rounded-xl border border-stroke bg-surface-elevated">
                  <div className="flex items-center gap-1 pr-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setSelectedSuiteId((current) => {
                          const belongsToPlan = suites.some(
                            (suite) => suite.id === current && suite.testPlanId === plan.id,
                          );
                          return belongsToPlan ? current : "";
                        });
                        setExpandedPlanIds((prev) => ({ ...prev, [plan.id]: !isOpen }));
                      }}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left",
                        isPlanSelected ? "text-ink" : "text-ink-muted",
                      )}
                    >
                      <IconChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "")} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{plan.name}</p>
                        <p className="truncate text-xs text-ink-soft">{plan.project.key} · {plan.project.name}</p>
                      </div>
                    </button>
                    {canManage ? (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="quiet"
                          className="h-8 w-8 rounded-lg p-0 text-ink-soft hover:bg-surface-muted hover:text-ink"
                          onClick={() => handleEditPlan(plan)}
                          aria-label={`Edit ${plan.name}`}
                          title="Edit test plan"
                        >
                          <IconEdit className="h-4 w-4 shrink-0" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="quiet"
                          className="h-8 w-8 rounded-lg p-0 text-brand-500 hover:bg-brand-500/10 hover:text-brand-400"
                          onClick={() => handleStartInlineCreate(plan.id)}
                          aria-label={`Create suite in ${plan.name}`}
                          title="Create test suite"
                          disabled={isInlineSaving || isInlineEditingSaving}
                        >
                          <IconPlus className="h-4 w-4 shrink-0" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {isOpen ? (
                    <div
                      data-testid={`plan-root-drop-${plan.id}`}
                      onDragOver={(event: DragEvent<HTMLDivElement>) => {
                        if (!draggingSuiteId) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = canAcceptRootDrop ? "move" : "none";
                        setDropTargetPlanId(plan.id);
                        setDropTargetSuiteId(null);
                      }}
                      onDragLeave={(event: DragEvent<HTMLDivElement>) => {
                        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                        if (dropTargetPlanId === plan.id) setDropTargetPlanId(null);
                      }}
                      onDrop={(event: DragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        void handleDropToPlanRoot(plan.id);
                        setDraggingSuiteId(null);
                        setDropTargetPlanId(null);
                        setDropTargetSuiteId(null);
                      }}
                      className={cn(
                        "pb-2",
                        isPlanRootDropTarget && canAcceptRootDrop ? "rounded-b-xl ring-2 ring-brand-300" : "",
                        isPlanRootDropTarget && !canAcceptRootDrop ? "rounded-b-xl ring-2 ring-danger-300" : "",
                      )}
                    >
                      {inlinePlanId === plan.id ? (
                        <div className="px-3 pb-2">
                          <input
                            autoFocus
                            value={inlineDraft}
                            onChange={(event) => {
                              setInlineDraft(event.target.value);
                              if (inlineError) setInlineError(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                if (!isInlineSaving) {
                                  void handleInlineCreateSubmit(plan.id, inlineDraft);
                                }
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                if (!isInlineSaving) resetInlineCreateState();
                              }
                            }}
                            onBlur={() => {
                              if (!isInlineCreating || isInlineSaving) return;
                              const trimmed = inlineDraft.trim();
                              if (!trimmed) {
                                resetInlineCreateState();
                                return;
                              }
                              void handleInlineCreateSubmit(plan.id, inlineDraft);
                            }}
                            disabled={isInlineSaving}
                            placeholder="New suite name"
                            aria-label={`New suite name for ${plan.name}`}
                            className="h-9 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-70"
                          />
                          {inlineError ? (
                            <p className="mt-1 text-xs text-danger-500">{inlineError}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {renderSuiteNodes(suitesByPlan[plan.id] ?? [], 1, plan.id)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface">
        <header className="border-b border-stroke px-8 py-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              {selectedSuite ? selectedSuite.name : selectedPlan ? selectedPlan.name : "Test Workspace"}
            </h2>
          </div>
          <p className="mt-1.5 text-sm text-ink-muted">
            {selectedSuite
              ? `${selectedSuite.testPlan.project.key} · ${selectedSuite.testPlan.name}`
              : "Select a suite from the left panel to view related test cases."}
          </p>
        </header>

        {!selectedSuiteId ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700">
                <IconFolder className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-ink">
                Select a test suite
              </h3>
              <p className="mt-2 text-sm text-ink-muted">
                Choose a suite in the left hierarchy to display and manage its test cases.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col p-6">
            <div>
              <TestManagementCasesHeader
                query={query}
                onQueryChange={setQuery}
                status={statusFilter}
                onStatusChange={setStatusFilter}
                priority={priorityFilter}
                onPriorityChange={setPriorityFilter}
                tag={tagFilter}
                onTagChange={setTagFilter}
                tagOptions={tags}
                onCreate={handleCreate}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPdf}
                canCreate={canManage}
              />
            </div>

            <div className="mt-3 rounded-xl border border-stroke bg-surface p-4">
              <div className="mb-3 text-xs font-medium text-ink-soft">
                {loadingCases ? "Updating..." : `Total: ${total}`}
              </div>

              {casesError ? (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
                  <span>{casesError}</span>
                  <Button size="xs" variant="critical" onClick={() => void fetchCases()}>
                    Retry
                  </Button>
                </div>
              ) : null}
              {tagsError ? (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-warning-500/20 bg-warning-500/10 px-4 py-3 text-sm text-warning-500">
                  <span>{tagsError}</span>
                  <Button size="xs" variant="soft" onClick={() => void fetchTags()}>
                    Reload tags
                  </Button>
                </div>
              ) : null}

              <TestCasesTable
                items={items}
                loading={loadingCases}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                canManage={canManage}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
              />

              <div className="mt-4">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[5, 10, 20, 30]}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {canManage ? (
        <TestCaseFormSheet
          open={modalOpen}
          testCase={editing}
          suites={suiteOptions}
          defaultSuiteId={selectedSuiteId || undefined}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      ) : null}

      <TestCaseDetailSheet
        open={isDetailOpen}
        testCase={selectedDetailCase}
        onClose={() => setIsDetailOpen(false)}
      />

      {canManage ? (
        <TestPlanFormSheet
          open={planModalOpen}
          plan={editingPlan}
          projects={projects}
          onClose={() => {
            setPlanModalOpen(false);
            setEditingPlan(null);
          }}
          onSave={handleSavePlan}
          onDelete={handleDeletePlan}
        />
      ) : null}

      <ConfirmationDialog
        open={deleteConfirmation.open}
        title={`Delete test case "${deleteConfirmation.title}"?`}
        description="This action will permanently delete the test case. This cannot be undone."
        confirmText="Delete"
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() =>
          setDeleteConfirmation({
            open: false,
            id: null,
            title: "",
            isConfirming: false,
          })
        }
        isConfirming={deleteConfirmation.isConfirming}
      />
      <ConfirmationDialog
        open={duplicateConfirmation.open}
        title={`Duplicate test case "${duplicateConfirmation.title}"?`}
        description="A new copy will be created in the same suite."
        confirmText="Duplicate"
        variant="info"
        onConfirm={() => void handleConfirmDuplicate()}
        onCancel={() =>
          setDuplicateConfirmation({
            open: false,
            id: null,
            title: "",
            isConfirming: false,
          })
        }
        isConfirming={duplicateConfirmation.isConfirming}
      />
    </div>
  );
}
