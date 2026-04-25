import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToStream,
} from "@react-pdf/renderer";
import { Prisma, TestCaseStatus, TestCaseStyle } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import { parseSortBy, parseSortDir } from "@/lib/sorting";
import { serializeTestCaseSteps } from "@/lib/test-cases/export-steps";

const EXPORT_LIMIT = 5000;
const STATUS_VALUES: TestCaseStatus[] = ["draft", "ready", "deprecated"];
const SORTABLE_FIELDS = [
  "case",
  "suite",
  "status",
  "tags",
  "priority",
  "automation",
] as const;
type TestCaseSortBy = (typeof SORTABLE_FIELDS)[number];

const exportStyles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
  },
  header: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginVertical: 8,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 5,
  },
  cellCase: { width: "35%", paddingRight: 6 },
  cellSuite: { width: "30%", paddingRight: 6 },
  cellStatus: { width: "15%", paddingRight: 6 },
  cellMeta: { width: "20%" },
  detailBlock: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
  },
  detailTitle: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 3,
  },
  detailText: {
    fontSize: 8,
    lineHeight: 1.35,
    color: "#374151",
  },
});

function parseStatus(value?: string | null): TestCaseStatus | null {
  if (!value) return null;
  return STATUS_VALUES.includes(value as TestCaseStatus)
    ? (value as TestCaseStatus)
    : null;
}

function parsePriorityFilter(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > 5) return null;
  return parsed;
}

function formatTimestampForFilename(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

// Neutralize spreadsheet formula injection (CWE-1236). Excel/Sheets/Numbers
// will execute a cell whose first character is one of `= + - @ \t \r`,
// which lets an attacker craft a test-case title like `=cmd|'/c calc'!A0`
// and have it run when a teammate opens the export. Prefix a single quote
// so the cell is treated as literal text.
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);
function safeCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (value.length === 0) return "";
  return FORMULA_TRIGGERS.has(value[0]) ? `'${value}` : value;
}

function formatDate(value: Date): string {
  return value.toISOString();
}

function formatStyle(style: TestCaseStyle): string {
  switch (style) {
    case "step_by_step":
      return "Step-by-Step";
    case "gherkin":
      return "BDD/Gherkin";
    case "data_driven":
      return "Data-Driven";
    case "api":
      return "API";
    default:
      return style;
  }
}

function buildFilterSummary(searchParams: URLSearchParams, total: number): string[] {
  const summary: string[] = [`Total exported: ${total}`];
  const filterPairs: Array<[string, string | null]> = [
    ["Query", searchParams.get("query")?.trim() || null],
    ["Suite", searchParams.get("suiteId")?.trim() || null],
    ["Tag", searchParams.get("tag")?.trim() || null],
    ["Test Plan", searchParams.get("testPlanId")?.trim() || null],
    ["Project", searchParams.get("projectId")?.trim() || null],
    ["Status", searchParams.get("status")?.trim() || null],
    ["Priority", searchParams.get("priority")?.trim() || null],
    ["Sort", searchParams.get("sortBy")?.trim() || null],
    ["Direction", searchParams.get("sortDir")?.trim() || null],
  ];

  filterPairs.forEach(([label, value]) => {
    if (value) summary.push(`${label}: ${value}`);
  });
  return summary;
}

const TEST_CASE_INCLUDE = {
  suite: {
    select: {
      id: true,
      name: true,
      testPlan: {
        select: {
          id: true,
          name: true,
          project: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TestCaseInclude;

type ExportCaseItem = Prisma.TestCaseGetPayload<{ include: typeof TEST_CASE_INCLUDE }>;

function buildPdfDocument(items: ExportCaseItem[], filterSummary: string[]) {
  return (
    <Document>
      <Page size="A4" style={exportStyles.page}>
        <View style={exportStyles.header}>
          <Text style={exportStyles.title}>Test Cases Export</Text>
          <Text style={exportStyles.subtitle}>
            Generated at {new Date().toLocaleString()}
          </Text>
          {filterSummary.map((line) => (
            <Text key={line} style={exportStyles.subtitle}>
              {line}
            </Text>
          ))}
        </View>

        <Text style={exportStyles.sectionTitle}>Summary</Text>
        <View style={[exportStyles.row, { borderBottomWidth: 1 }]}>
          <Text style={exportStyles.cellCase}>Case</Text>
          <Text style={exportStyles.cellSuite}>Suite</Text>
          <Text style={exportStyles.cellStatus}>Status</Text>
          <Text style={exportStyles.cellMeta}>Priority / Style</Text>
        </View>

        {items.map((item) => {
          const steps = serializeTestCaseSteps(item.style, item.steps);
          return (
            <View key={item.id}>
              <View style={exportStyles.row}>
                <Text style={exportStyles.cellCase}>{item.title}</Text>
                <Text style={exportStyles.cellSuite}>
                  {item.suite.testPlan.project.key} · {item.suite.testPlan.name} · {item.suite.name}
                </Text>
                <Text style={exportStyles.cellStatus}>{item.status}</Text>
                <Text style={exportStyles.cellMeta}>
                  P{item.priority} / {formatStyle(item.style)}
                </Text>
              </View>
              <View style={exportStyles.detailBlock}>
                <Text style={exportStyles.detailTitle}>Description</Text>
                <Text style={exportStyles.detailText}>{item.description || "N/A"}</Text>
                <Text style={exportStyles.detailTitle}>Preconditions</Text>
                <Text style={exportStyles.detailText}>{item.preconditions || "N/A"}</Text>
                <Text style={exportStyles.detailTitle}>Steps ({steps.summary})</Text>
                <Text style={exportStyles.detailText}>{steps.detail}</Text>
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

export const runtime = "nodejs";

export const GET = withAuth(
  PERMISSIONS.TEST_CASE_LIST,
  async (req: NextRequest, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format")?.trim().toLowerCase();

    if (format !== "xlsx" && format !== "pdf") {
      return NextResponse.json(
        { message: "Invalid format. Use format=xlsx or format=pdf." },
        { status: 400 },
      );
    }

    const query = searchParams.get("query")?.trim();
    const suiteId = searchParams.get("suiteId")?.trim();
    const tag = searchParams.get("tag")?.trim();
    const testPlanId = searchParams.get("testPlanId")?.trim();
    const projectId = searchParams.get("projectId")?.trim();
    const status = parseStatus(searchParams.get("status")?.trim() ?? null);
    const priority = parsePriorityFilter(searchParams.get("priority")?.trim() ?? null);
    const requestedSortBy = searchParams.get("sortBy");
    const sortBy =
      requestedSortBy && SORTABLE_FIELDS.includes(requestedSortBy as TestCaseSortBy)
        ? parseSortBy<TestCaseSortBy>(requestedSortBy, SORTABLE_FIELDS, "case")
        : null;
    const sortDir = parseSortDir(searchParams.get("sortDir"), "asc");

    if (projectId) {
      const allowed = await can(PERMISSIONS.TEST_CASE_LIST, {
        userId,
        globalRoles,
        organizationId: activeOrganizationId,
        organizationRole,
        projectId,
      });

      if (!allowed) {
        return NextResponse.json(
          { message: "You do not have access to this project." },
          { status: 403 },
        );
      }
    }

    const filters: Prisma.TestCaseWhereInput[] = [];

    if (activeOrganizationId) {
      filters.push({
        suite: { testPlan: { project: { organizationId: activeOrganizationId } } },
      });
    }

    if (suiteId) filters.push({ suiteId });
    if (tag) filters.push({ tags: { has: tag } });
    if (testPlanId) filters.push({ suite: { testPlanId } });
    if (projectId) filters.push({ suite: { testPlan: { projectId } } });
    if (status) filters.push({ status });
    if (priority !== null) filters.push({ priority });

    if (query) {
      filters.push({
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { preconditions: { contains: query, mode: "insensitive" } },
          { externalKey: { contains: query, mode: "insensitive" } },
          { suite: { name: { contains: query, mode: "insensitive" } } },
          { suite: { testPlan: { name: { contains: query, mode: "insensitive" } } } },
          {
            suite: {
              testPlan: {
                project: { name: { contains: query, mode: "insensitive" } },
              },
            },
          },
          {
            suite: {
              testPlan: {
                project: { key: { contains: query, mode: "insensitive" } },
              },
            },
          },
        ],
      });
    }

    if (!organizationRole || (organizationRole !== "owner" && organizationRole !== "admin")) {
      filters.push({
        suite: {
          testPlan: {
            project: {
              members: {
                some: { userId },
              },
            },
          },
        },
      });
    }

    const where: Prisma.TestCaseWhereInput = filters.length ? { AND: filters } : {};

    let orderBy: Prisma.TestCaseOrderByWithRelationInput[] = [
      { updatedAt: "desc" },
      { id: "asc" },
    ];

    if (sortBy) {
      switch (sortBy) {
        case "case":
          orderBy = [{ title: sortDir }, { updatedAt: "desc" }, { id: "asc" }];
          break;
        case "suite":
          orderBy = [{ suite: { name: sortDir } }, { title: "asc" }, { id: "asc" }];
          break;
        case "status":
        case "priority":
          orderBy = [{ [sortBy]: sortDir }, { title: "asc" }, { id: "asc" }];
          break;
        case "tags":
          orderBy = [{ title: sortDir }, { updatedAt: "desc" }, { id: "asc" }];
          break;
        case "automation":
          orderBy = [
            { isAutomated: sortDir },
            { automationType: sortDir },
            { title: "asc" },
            { id: "asc" },
          ];
          break;
      }
    }

    const total = await prisma.testCase.count({ where });
    if (total > EXPORT_LIMIT) {
      return NextResponse.json(
        {
          message: `Export is limited to ${EXPORT_LIMIT} test cases. Current filtered result: ${total}. Refine filters and try again.`,
        },
        { status: 400 },
      );
    }

    const items = await prisma.testCase.findMany({
      where,
      include: TEST_CASE_INCLUDE,
      orderBy,
      take: EXPORT_LIMIT,
    });

    const timestamp = formatTimestampForFilename();
    const filename = `test-cases-${timestamp}.${format}`;
    const filterSummary = buildFilterSummary(searchParams, items.length);

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Test Manager";
      workbook.created = new Date();
      const sheet = workbook.addWorksheet("Test Cases");

      sheet.columns = [
        { header: "Case Title", key: "title", width: 36 },
        { header: "External Key", key: "externalKey", width: 18 },
        { header: "Project", key: "project", width: 20 },
        { header: "Test Plan", key: "testPlan", width: 28 },
        { header: "Suite", key: "suite", width: 24 },
        { header: "Status", key: "status", width: 14 },
        { header: "Priority", key: "priority", width: 10 },
        { header: "Style", key: "style", width: 16 },
        { header: "Automated", key: "automated", width: 12 },
        { header: "Automation Type", key: "automationType", width: 18 },
        { header: "Automation Ref", key: "automationRef", width: 24 },
        { header: "Tags", key: "tags", width: 30 },
        { header: "Description", key: "description", width: 45 },
        { header: "Preconditions", key: "preconditions", width: 45 },
        { header: "Steps Summary", key: "stepsSummary", width: 26 },
        { header: "Steps Detail", key: "stepsDetail", width: 80 },
        { header: "Created At", key: "createdAt", width: 24 },
        { header: "Updated At", key: "updatedAt", width: 24 },
      ];

      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];

      items.forEach((item) => {
        const serializedSteps = serializeTestCaseSteps(item.style, item.steps);
        sheet.addRow({
          title: safeCell(item.title),
          externalKey: safeCell(item.externalKey),
          project: safeCell(`${item.suite.testPlan.project.key} - ${item.suite.testPlan.project.name}`),
          testPlan: safeCell(item.suite.testPlan.name),
          suite: safeCell(item.suite.name),
          status: item.status,
          priority: `P${item.priority}`,
          style: formatStyle(item.style),
          automated: item.isAutomated ? "Yes" : "No",
          automationType: safeCell(item.automationType),
          automationRef: safeCell(item.automationRef),
          tags: safeCell(item.tags.join(", ")),
          description: safeCell(item.description),
          preconditions: safeCell(item.preconditions),
          stepsSummary: safeCell(serializedSteps.summary),
          stepsDetail: safeCell(serializedSteps.detail),
          createdAt: formatDate(item.createdAt),
          updatedAt: formatDate(item.updatedAt),
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdfStream = await renderToStream(buildPdfDocument(items, filterSummary));
    const webStream = new ReadableStream<Uint8Array>({
      start(controller) {
        pdfStream.on("data", (chunk: Buffer | Uint8Array | string) => {
          if (typeof chunk === "string") {
            controller.enqueue(new TextEncoder().encode(chunk));
            return;
          }
          controller.enqueue(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
        });
        pdfStream.on("end", () => controller.close());
        pdfStream.on("error", (error: Error) => controller.error(error));
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  },
);
