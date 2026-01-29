
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import React from "react";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    renderToStream,
} from "@react-pdf/renderer";

type RouteParams = {
    params: Promise<{
        id: string;
    }>;
};

// PDF Styles
const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: "Helvetica", fontSize: 10, color: "#111827" },
    header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 10 },
    title: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
    subtitle: { fontSize: 12, color: "#6B7280" },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 8, backgroundColor: "#F3F4F6", padding: 5 },
    row: { flexDirection: "row", marginBottom: 4 },
    label: { width: 100, fontWeight: "bold", color: "#6B7280" },
    value: { flex: 1 },
    metricBox: { flex: 1, padding: 10, backgroundColor: "#F9FAFB", margin: 2, alignItems: "center" },
    metricLabel: { fontSize: 8, color: "#6B7280", textTransform: "uppercase" },
    metricValue: { fontSize: 16, fontWeight: "bold", marginTop: 4 },
    tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 5, marginBottom: 5, fontWeight: "bold", fontSize: 9, color: "#6B7280" },
    tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" },
    colStatus: { width: 60 },
    colKey: { width: 80 },
    colTitle: { flex: 1 },
    colDuration: { width: 60 },
    statusPassed: { color: "#16A34A" },
    statusFailed: { color: "#DC2626" },
    statusSkipped: { color: "#6B7280" },
    statusBlocked: { color: "#D97706" },
    statusNotRun: { color: "#9CA3AF" },
});

const getStatusColor = (status: string) => {
    switch (status) {
        case "passed": return styles.statusPassed;
        case "failed": return styles.statusFailed;
        case "skipped": return styles.statusSkipped;
        case "blocked": return styles.statusBlocked;
        default: return styles.statusNotRun;
    }
};

const PDFDocument = ({ run, metrics, items }: any) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>{run.project.key} Test Run Report</Text>
                <Text style={styles.subtitle}>{run.name || `Run ${run.id}`}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Details</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Environment:</Text>
                    <Text style={styles.value}>{run.environment || "N/A"}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Build:</Text>
                    <Text style={styles.value}>{run.buildNumber || "N/A"}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Started:</Text>
                    <Text style={styles.value}>{run.startedAt ? new Date(run.startedAt).toLocaleString() : "N/A"}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Finished:</Text>
                    <Text style={styles.value}>{run.finishedAt ? new Date(run.finishedAt).toLocaleString() : "N/A"}</Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Metrics</Text>
                <View style={{ flexDirection: "row" }}>
                    {[
                        { label: "Total", value: metrics.total },
                        { label: "Passed", value: metrics.passed },
                        { label: "Failed", value: metrics.failed },
                        { label: "Pass Rate", value: `${metrics.passRate}%` },
                    ].map((m, i) => (
                        <View key={i} style={styles.metricBox}>
                            <Text style={styles.metricLabel}>{m.label}</Text>
                            <Text style={styles.metricValue}>{m.value}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Test Items</Text>
                <View style={styles.tableHeader}>
                    <Text style={styles.colKey}>Key</Text>
                    <Text style={styles.colTitle}>Title</Text>
                    <Text style={styles.colStatus}>Status</Text>
                    <Text style={styles.colDuration}>Duration</Text>
                </View>
                {items.map((item: any) => (
                    <View key={item.id} style={styles.tableRow}>
                        <Text style={styles.colKey}>{item.testCase.externalKey || "?"}</Text>
                        <Text style={styles.colTitle}>{item.testCase.title}</Text>
                        <Text style={[styles.colStatus, getStatusColor(item.status)]}>{item.status}</Text>
                        <Text style={styles.colDuration}>{item.durationMs ? `${item.durationMs}ms` : "-"}</Text>
                    </View>
                ))}
            </View>
        </Page>
    </Document>
);

const generateHTML = (run: any, metrics: any, items: any) => {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: ui-sans-serif, system-ui, sans-serif; color: #111827; max-width: 800px; margin: 0 auto; padding: 40px; }
          h1 { margin-bottom: 5px; font-size: 24px; }
          .meta { color: #6B7280; margin-bottom: 30px; font-size: 14px; }
          .section { margin-bottom: 30px; }
          h2 { background: #F3F4F6; padding: 10px; font-size: 16px; margin-bottom: 15px; border-radius: 4px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 14px; }
          .label { font-weight: bold; color: #4B5563; }
          .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          .metric { background: #F9FAFB; padding: 15px; text-align: center; border-radius: 8px; border: 1px solid #E5E7EB; }
          .metric-label { font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 0.05em; }
          .metric-value { font-size: 20px; font-weight: bold; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
          th { text-align: left; border-bottom: 2px solid #E5E7EB; padding: 8px; color: #6B7280; font-size: 12px; }
          td { border-bottom: 1px solid #F3F4F6; padding: 8px; vertical-align: top; }
          .status { font-weight: 600; text-transform: capitalize; }
          .passed { color: #16A34A; }
          .failed { color: #DC2626; }
          .skipped { color: #6B7280; }
          .blocked { color: #D97706; }
        </style>
      </head>
      <body>
        <h1>${run.project.key} Test Run Report</h1>
        <div class="meta">
          ${run.name || `Run ${run.id}`} · Generated on ${new Date().toLocaleString()}
        </div>

        <div class="section">
          <h2>Details</h2>
          <div class="grid">
            <div><span class="label">Environment:</span> ${run.environment || "N/A"}</div>
            <div><span class="label">Build:</span> ${run.buildNumber || "N/A"}</div>
            <div><span class="label">Started:</span> ${run.startedAt ? new Date(run.startedAt).toLocaleString() : "N/A"}</div>
            <div><span class="label">Finished:</span> ${run.finishedAt ? new Date(run.finishedAt).toLocaleString() : "N/A"}</div>
          </div>
        </div>

        <div class="section">
          <h2>Metrics</h2>
          <div class="metrics">
            <div class="metric"><div class="metric-label">Total</div><div class="metric-value">${metrics.total}</div></div>
            <div class="metric"><div class="metric-label">Passed</div><div class="metric-value">${metrics.passed}</div></div>
            <div class="metric"><div class="metric-label">Failed</div><div class="metric-value">${metrics.failed}</div></div>
            <div class="metric"><div class="metric-label">Pass Rate</div><div class="metric-value">${metrics.passRate}%</div></div>
          </div>
        </div>

        <div class="section">
          <h2>Test Items</h2>
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Title</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any) => `
                <tr>
                  <td>${item.testCase.externalKey || ""}</td>
                  <td>${item.testCase.title}</td>
                  <td class="status ${item.status}">${item.status}</td>
                  <td>${item.durationMs ? item.durationMs + "ms" : "-"}</td>
                  <td style="color: #DC2626">${item.errorMessage || ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") || "html";

    try {
        const run = await prisma.testRun.findUnique({
            where: { id },
            include: {
                project: true,
                items: {
                    include: {
                        testCase: true,
                        executedBy: true,
                    },
                    orderBy: { testCase: { title: "asc" } },
                },
            },
        });

        if (!run) {
            return NextResponse.json({ message: "Run not found" }, { status: 404 });
        }

        // Calculate metrics
        const total = run.items.length;
        const passed = run.items.filter((i) => i.status === "passed").length;
        const failed = run.items.filter((i) => i.status === "failed").length;
        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
        const metrics = { total, passed, failed, passRate };

        if (format === "pdf") {
            const stream = await renderToStream(<PDFDocument run={run} metrics={metrics} items={run.items} />);

            // Convert Node stream to Web ReadableStream
            const webStream = new ReadableStream({
                start(controller) {
                    stream.on("data", (chunk: any) => controller.enqueue(chunk));
                    stream.on("end", () => controller.close());
                    stream.on("error", (err: any) => controller.error(err));
                },
            });

            return new NextResponse(webStream, {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="run-${run.project.key}-${id}.pdf"`,
                },
            });
        } else {
            const html = generateHTML(run, metrics, run.items);
            return new NextResponse(html, {
                headers: {
                    "Content-Type": "text/html",
                    "Content-Disposition": `attachment; filename="run-${run.project.key}-${id}.html"`,
                },
            });
        }
    } catch (error) {
        console.error("Export error:", error);
        return NextResponse.json({ message: "Export failed" }, { status: 500 });
    }
}
