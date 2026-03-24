
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import React from "react";
import {
    Document,
    Page,
    Text,
    View,
    Image,
    StyleSheet,
    renderToStream,
} from "@react-pdf/renderer";
import { Readable } from "stream";
import { parseSteps } from "@/lib/parse-steps";
import { getPresignedUrl, getS3Config } from "@/lib/s3";

type RouteParams = {
    params: Promise<{
        id: string;
    }>;
};
type ExportRunItem = {
    id: string;
    status: string;
    durationMs: number | null;
    errorMessage: string | null;
    testCase: {
        externalKey: string | null;
        title: string;
    };
};
type ExportRun = {
    id: string;
    name: string | null;
    environment: string | null;
    buildNumber: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    project: {
        key: string;
    };
    items: ExportRunItem[];
};
type ExportMetrics = {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
};

type ExportStepResult = {
    stepIndex: number;
    stepTextSnapshot: string;
    expectedSnapshot: string | null;
    status: string;
    actualResult: string | null;
    comment: string | null;
};

type ExportArtifact = {
    url: string;
    name: string | null;
    mimeType: string | null;
    metadata: unknown;
};

type ExportRunItemComplete = ExportRunItem & {
    currentExecution: {
        status: string;
        attemptNumber: number;
        summary: string | null;
        stepResults: ExportStepResult[];
        artifacts: ExportArtifact[];
    } | null;
    testCase: ExportRunItem["testCase"] & { style: string; steps: unknown };
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
    tableRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" },
    colStatus: { width: 60, fontWeight: "bold" },
    colKey: { width: 80, paddingRight: 4 },
    colTitle: { flex: 1, paddingRight: 10 },
    colDuration: { width: 60 },
    statusPassed: { color: "#16A34A" },
    statusFailed: { color: "#DC2626" },
    statusSkipped: { color: "#6B7280" },
    statusBlocked: { color: "#D97706" },
    statusNotRun: { color: "#9CA3AF" },
    // Complete mode styles
    itemCard: { marginBottom: 14, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 4, padding: 10 },
    itemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    itemTitle: { fontSize: 11, fontWeight: "bold" },
    stepRow: { flexDirection: "row", marginBottom: 4, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: "#E5E7EB", paddingVertical: 2 },
    stepIndex: { width: 20, fontSize: 9, color: "#6B7280" },
    stepContent: { flex: 1 },
    stepText: { fontSize: 9 },
    stepExpected: { fontSize: 8, color: "#6B7280", marginTop: 1 },
    stepActual: { fontSize: 8, color: "#374151", marginTop: 1 },
    stepComment: { fontSize: 8, color: "#6B7280", fontStyle: "italic", marginTop: 1 },
    stepStatusBadge: { fontSize: 8, fontWeight: "bold" },
    artifactImage: { maxWidth: 250, maxHeight: 200, marginTop: 4, marginBottom: 4 },
    noExecution: { fontSize: 9, color: "#9CA3AF", fontStyle: "italic", marginTop: 4 },
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

const getStatusColorHex = (status: string) => {
    switch (status) {
        case "passed": return "#16A34A";
        case "failed": return "#DC2626";
        case "skipped": return "#6B7280";
        case "blocked": return "#D97706";
        default: return "#9CA3AF";
    }
};

const PDFDocument = ({ run, metrics, items }: {
    run: ExportRun;
    metrics: ExportMetrics;
    items: ExportRunItem[];
}) => (
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
                {items.map((item) => (
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

function extractS3Key(url: string): string | null {
    try {
        const { bucket, endpoint } = getS3Config("artifacts");
        const base = (process.env.S3_PUBLIC_URL ?? endpoint).replace(/\/$/, "");
        const bucketPrefix = `${base}/${bucket}/`;
        if (url.startsWith(bucketPrefix)) {
            return decodeURI(url.slice(bucketPrefix.length));
        }
    } catch { /* s3 not configured */ }
    return null;
}

async function signArtifactUrl(url: string): Promise<string> {
    const key = extractS3Key(url);
    if (!key) return url;
    try {
        return await getPresignedUrl("artifacts", key);
    } catch {
        return url;
    }
}

async function fetchImageAsDataUri(url: string, mimeType: string | null): Promise<string | null> {
    const signedUrl = await signArtifactUrl(url);
    try {
        const res = await fetch(signedUrl);
        if (!res.ok) return null;
        const buffer = Buffer.from(await res.arrayBuffer());
        const mime = mimeType || res.headers.get("content-type") || "image/png";
        return `data:${mime};base64,${buffer.toString("base64")}`;
    } catch {
        return null;
    }
}

async function resolveArtifactImages(
    items: ExportRunItemComplete[],
    target: "pdf" | "html",
): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();
    const imageArtifacts: ExportArtifact[] = [];

    for (const item of items) {
        const artifacts = item.currentExecution?.artifacts ?? [];
        for (const a of artifacts) {
            if (!a.mimeType?.startsWith("image/")) continue;
            if (urlMap.has(a.url)) continue;
            imageArtifacts.push(a);
            urlMap.set(a.url, a.url); // placeholder
        }
    }

    await Promise.all(
        imageArtifacts.map(async (a) => {
            if (target === "pdf") {
                const dataUri = await fetchImageAsDataUri(a.url, a.mimeType);
                if (dataUri) urlMap.set(a.url, dataUri);
            } else {
                const signed = await signArtifactUrl(a.url);
                urlMap.set(a.url, signed);
            }
        }),
    );

    return urlMap;
}

function getStepArtifacts(artifacts: ExportArtifact[], stepIndex: number): ExportArtifact[] {
    return artifacts.filter((a) => {
        if (!a.mimeType?.startsWith("image/")) return false;
        const meta = a.metadata as { scope?: string; stepIndex?: number } | null;
        return meta?.scope === "step" && meta?.stepIndex === stepIndex;
    });
}

const CompletePDFDocument = ({ run, metrics, items, resolvedUrls }: {
    run: ExportRun;
    metrics: ExportMetrics;
    items: ExportRunItemComplete[];
    resolvedUrls: Map<string, string>;
}) => (
    <Document>
        <Page size="A4" style={styles.page} wrap>
            <View style={styles.header}>
                <Text style={styles.title}>{run.project.key} Test Run Report (Complete)</Text>
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
                <Text style={styles.sectionTitle}>Test Items — Detailed</Text>
                {items.map((item) => {
                    const exec = item.currentExecution;
                    const steps = exec
                        ? exec.stepResults
                        : parseSteps(item.testCase.style, item.testCase.steps);
                    const artifacts = exec?.artifacts ?? [];

                    return (
                        <View key={item.id} style={styles.itemCard} wrap={false}>
                            <View style={styles.itemHeader}>
                                <Text style={styles.itemTitle}>
                                    {item.testCase.externalKey ? `${item.testCase.externalKey} — ` : ""}
                                    {item.testCase.title}
                                </Text>
                                <Text style={[styles.stepStatusBadge, getStatusColor(item.status)]}>
                                    {item.status.toUpperCase()}
                                </Text>
                            </View>

                            {exec?.summary && (
                                <Text style={styles.stepComment}>Notes: {exec.summary}</Text>
                            )}

                            {!exec && (
                                <Text style={styles.noExecution}>No execution data — showing test case steps</Text>
                            )}

                            {exec && steps.length === 0 && (
                                <Text style={styles.noExecution}>No steps recorded</Text>
                            )}

                            {steps.map((step, idx) => {
                                const isStepResult = "stepIndex" in step;
                                const stepIdx = isStepResult ? (step as ExportStepResult).stepIndex : idx;
                                const stepImages = getStepArtifacts(artifacts, stepIdx);

                                return (
                                    <View key={idx} style={styles.stepRow}>
                                        <Text style={styles.stepIndex}>{stepIdx + 1}.</Text>
                                        <View style={styles.stepContent}>
                                            <Text style={styles.stepText}>
                                                {isStepResult
                                                    ? (step as ExportStepResult).stepTextSnapshot
                                                    : (step as { text: string }).text}
                                            </Text>
                                            {isStepResult && (step as ExportStepResult).expectedSnapshot && (
                                                <Text style={styles.stepExpected}>
                                                    Expected: {(step as ExportStepResult).expectedSnapshot}
                                                </Text>
                                            )}
                                            {!isStepResult && (step as { expected?: string | null }).expected && (
                                                <Text style={styles.stepExpected}>
                                                    Expected: {(step as { expected: string }).expected}
                                                </Text>
                                            )}
                                            {isStepResult && (
                                                <Text style={[styles.stepStatusBadge, getStatusColor((step as ExportStepResult).status)]}>
                                                    {(step as ExportStepResult).status}
                                                </Text>
                                            )}
                                            {!isStepResult && (
                                                <Text style={[styles.stepStatusBadge, { color: "#9CA3AF" }]}>
                                                    Not executed
                                                </Text>
                                            )}
                                            {isStepResult && (step as ExportStepResult).actualResult && (
                                                <Text style={styles.stepActual}>
                                                    Actual: {(step as ExportStepResult).actualResult}
                                                </Text>
                                            )}
                                            {isStepResult && (step as ExportStepResult).comment && (
                                                <Text style={styles.stepComment}>
                                                    {(step as ExportStepResult).comment}
                                                </Text>
                                            )}
                                            {stepImages.map((img, imgIdx) => {
                                                const resolved = resolvedUrls.get(img.url);
                                                if (!resolved) return null;
                                                return <Image key={imgIdx} src={resolved} style={styles.artifactImage} />;
                                            })}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    );
                })}
            </View>
        </Page>
    </Document>
);

const generateHTML = (run: ExportRun, metrics: ExportMetrics, items: ExportRunItem[]) => {
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
        <h1>${escapeHtml(run.project.key)} Test Run Report</h1>
        <div class="meta">
          ${escapeHtml(run.name || `Run ${run.id}`)} &middot; Generated on ${new Date().toLocaleString()}
        </div>

        <div class="section">
          <h2>Details</h2>
          <div class="grid">
            <div><span class="label">Environment:</span> ${escapeHtml(run.environment || "N/A")}</div>
            <div><span class="label">Build:</span> ${escapeHtml(run.buildNumber || "N/A")}</div>
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
              ${items.map((item) => `
                <tr>
                  <td>${escapeHtml(item.testCase.externalKey || "")}</td>
                  <td>${escapeHtml(item.testCase.title)}</td>
                  <td class="status ${item.status}">${escapeHtml(item.status)}</td>
                  <td>${item.durationMs ? item.durationMs + "ms" : "-"}</td>
                  <td style="color: #DC2626">${escapeHtml(item.errorMessage || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
};

const generateCompleteHTML = (run: ExportRun, metrics: ExportMetrics, items: ExportRunItemComplete[], resolvedUrls: Map<string, string>) => {
    const itemsHTML = items.map((item) => {
        const exec = item.currentExecution;
        const steps = exec
            ? exec.stepResults
            : parseSteps(item.testCase.style, item.testCase.steps);
        const artifacts = exec?.artifacts ?? [];

        const stepsHTML = steps.map((step, idx) => {
            const isStepResult = "stepIndex" in step;
            const stepIdx = isStepResult ? (step as ExportStepResult).stepIndex : idx;
            const stepImages = artifacts.filter((a) => {
                if (!a.mimeType?.startsWith("image/")) return false;
                const meta = a.metadata as { scope?: string; stepIndex?: number } | null;
                return meta?.scope === "step" && meta?.stepIndex === stepIdx;
            });

            const stepText = isStepResult
                ? (step as ExportStepResult).stepTextSnapshot
                : (step as { text: string }).text;
            const expected = isStepResult
                ? (step as ExportStepResult).expectedSnapshot
                : (step as { expected?: string | null }).expected;
            const status = isStepResult
                ? (step as ExportStepResult).status
                : "not_executed";
            const actual = isStepResult ? (step as ExportStepResult).actualResult : null;
            const comment = isStepResult ? (step as ExportStepResult).comment : null;

            return `
                <div style="border-left: 3px solid ${getStatusColorHex(status)}; padding: 6px 10px; margin-bottom: 6px; background: #FAFAFA; border-radius: 0 4px 4px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="font-size: 13px;">${stepIdx + 1}. ${escapeHtml(stepText)}</strong>
                        <span style="color: ${getStatusColorHex(status)}; font-weight: 600; font-size: 12px;">${escapeHtml(status)}</span>
                    </div>
                    ${expected ? `<div style="color: #6B7280; font-size: 12px; margin-top: 2px;">Expected: ${escapeHtml(expected)}</div>` : ""}
                    ${actual ? `<div style="color: #374151; font-size: 12px; margin-top: 2px;">Actual: ${escapeHtml(actual)}</div>` : ""}
                    ${comment ? `<div style="color: #6B7280; font-size: 12px; font-style: italic; margin-top: 2px;">${escapeHtml(comment)}</div>` : ""}
                    ${stepImages.map((img) => {
                        const resolved = resolvedUrls.get(img.url) ?? img.url;
                        return `<img src="${escapeHtml(resolved)}" alt="${escapeHtml(img.name || "evidence")}" style="max-width: 300px; margin-top: 6px; border-radius: 4px; border: 1px solid #E5E7EB;" />`;
                    }).join("")}
                </div>
            `;
        }).join("");

        return `
            <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <strong style="font-size: 14px;">${escapeHtml(item.testCase.externalKey ? `${item.testCase.externalKey} — ` : "")}${escapeHtml(item.testCase.title)}</strong>
                    </div>
                    <span style="color: ${getStatusColorHex(item.status)}; font-weight: 700; font-size: 13px; text-transform: uppercase;">${escapeHtml(item.status)}</span>
                </div>
                ${exec?.summary ? `<div style="color: #6B7280; font-size: 12px; font-style: italic; margin-bottom: 8px; padding: 6px 10px; background: #F9FAFB; border-radius: 4px;">Notes: ${escapeHtml(exec.summary)}</div>` : ""}
                ${!exec ? '<div style="color: #9CA3AF; font-style: italic; font-size: 12px; margin-bottom: 6px;">No execution data — showing test case steps</div>' : ""}
                ${steps.length === 0 && exec ? '<div style="color: #9CA3AF; font-style: italic; font-size: 12px;">No steps recorded</div>' : ""}
                ${stepsHTML}
            </div>
        `;
    }).join("");

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: ui-sans-serif, system-ui, sans-serif; color: #111827; max-width: 900px; margin: 0 auto; padding: 40px; }
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
          @media print {
            body { padding: 20px; }
            div[style*="page-break-inside"] { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(run.project.key)} Test Run Report (Complete)</h1>
        <div class="meta">
          ${escapeHtml(run.name || `Run ${run.id}`)} &middot; Generated on ${new Date().toLocaleString()}
        </div>

        <div class="section">
          <h2>Details</h2>
          <div class="grid">
            <div><span class="label">Environment:</span> ${escapeHtml(run.environment || "N/A")}</div>
            <div><span class="label">Build:</span> ${escapeHtml(run.buildNumber || "N/A")}</div>
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
          <h2>Test Items — Detailed</h2>
          ${itemsHTML}
        </div>
      </body>
    </html>
  `;
};

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function streamToResponse(stream: NodeJS.ReadableStream, run: ExportRun, id: string): Promise<NextResponse> {
    const nodeStream = stream as unknown as Readable;
    const webStream = new ReadableStream({
        start(controller) {
            nodeStream.on("data", (chunk: Buffer | string) => controller.enqueue(chunk));
            nodeStream.on("end", () => controller.close());
            nodeStream.on("error", (err: Error) => controller.error(err));
        },
    });

    return new NextResponse(webStream, {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="run-${run.project.key}-${id}.pdf"`,
        },
    });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") || "html";
    const mode = searchParams.get("mode") || "simple";

    try {
        const isComplete = mode === "complete";

        const run = await prisma.testRun.findUnique({
            where: { id },
            include: {
                project: true,
                items: {
                    include: {
                        testCase: true,
                        executedBy: true,
                        ...(isComplete
                            ? {
                                  currentExecution: {
                                      include: {
                                          stepResults: { orderBy: { stepIndex: "asc" } },
                                          artifacts: true,
                                      },
                                  },
                              }
                            : {}),
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

        if (isComplete) {
            const completeItems = run.items as unknown as ExportRunItemComplete[];
            const resolvedUrls = await resolveArtifactImages(
                completeItems,
                format === "pdf" ? "pdf" : "html",
            );

            if (format === "pdf") {
                const stream = await renderToStream(
                    <CompletePDFDocument run={run} metrics={metrics} items={completeItems} resolvedUrls={resolvedUrls} />
                );
                return streamToResponse(stream, run, id);
            } else {
                const html = generateCompleteHTML(run, metrics, completeItems, resolvedUrls);
                return new NextResponse(html, {
                    headers: {
                        "Content-Type": "text/html",
                        "Content-Disposition": `attachment; filename="run-${run.project.key}-${id}-complete.html"`,
                    },
                });
            }
        }

        if (format === "pdf") {
            const stream = await renderToStream(<PDFDocument run={run} metrics={metrics} items={run.items} />);
            return streamToResponse(stream, run, id);
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
