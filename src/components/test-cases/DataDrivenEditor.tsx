"use client";

import { Button } from "../ui/Button";
import type { GherkinKeyword } from "./types";

type ClauseItem = { id: string; keyword: GherkinKeyword; text: string };
type Examples = { columns: string[]; rows: string[][] };

type DataDrivenEditorProps = {
  template: ClauseItem[];
  examples: Examples;
  onAddClause: () => void;
  onRemoveClause: (id: string) => void;
  onUpdateClause: (id: string, field: "keyword" | "text", value: string) => void;
  onUpdateExamples: (examples: Examples) => void;
};

const keywords: GherkinKeyword[] = ["Given", "When", "Then", "And"];

export function DataDrivenEditor({
  template,
  examples,
  onAddClause,
  onRemoveClause,
  onUpdateClause,
  onUpdateExamples,
}: DataDrivenEditorProps) {
  const addColumn = () => {
    const col = `col${examples.columns.length + 1}`;
    onUpdateExamples({
      columns: [...examples.columns, col],
      rows: examples.rows.map((row) => [...row, ""]),
    });
  };

  const removeColumn = (colIndex: number) => {
    onUpdateExamples({
      columns: examples.columns.filter((_, i) => i !== colIndex),
      rows: examples.rows.map((row) => row.filter((_, i) => i !== colIndex)),
    });
  };

  const updateColumnName = (colIndex: number, value: string) => {
    const cols = [...examples.columns];
    cols[colIndex] = value;
    onUpdateExamples({ ...examples, columns: cols });
  };

  const addRow = () => {
    onUpdateExamples({
      ...examples,
      rows: [...examples.rows, examples.columns.map(() => "")],
    });
  };

  const removeRow = (rowIndex: number) => {
    onUpdateExamples({
      ...examples,
      rows: examples.rows.filter((_, i) => i !== rowIndex),
    });
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const rows = examples.rows.map((row, ri) =>
      ri === rowIndex ? row.map((cell, ci) => (ci === colIndex ? value : cell)) : row,
    );
    onUpdateExamples({ ...examples, rows });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Template section */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-ink">
          Scenario Template
          <span className="ml-1 text-xs font-normal text-ink-muted">
            Use &lt;placeholder&gt; for variable data
          </span>
        </label>
        <div className="flex flex-col gap-3">
          {template.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-stroke bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <select
                  value={item.keyword}
                  onChange={(e) => onUpdateClause(item.id, "keyword", e.target.value)}
                  className="h-8 rounded border border-stroke bg-white px-2 text-sm font-medium text-ink"
                >
                  {keywords.map((kw) => (
                    <option key={kw} value={kw}>{kw}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onRemoveClause(item.id)}
                  className="text-xs text-danger-500 hover:text-danger-700"
                >
                  Delete
                </button>
              </div>
              <textarea
                value={item.text}
                onChange={(e) => onUpdateClause(item.id, "text", e.target.value)}
                placeholder='the user enters <username> and <password>'
                className="min-h-[50px] w-full rounded border border-stroke bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-300"
              />
            </div>
          ))}
          <Button type="button" variant="secondary" className="w-full" onClick={onAddClause}>
            + Add clause
          </Button>
        </div>
      </div>

      {/* Examples table section */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-ink">Examples Table</label>
        {examples.columns.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-stroke">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {examples.columns.map((col, colIdx) => (
                    <th key={colIdx} className="border-b border-stroke px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          value={col}
                          onChange={(e) => updateColumnName(colIdx, e.target.value)}
                          className="w-full rounded border border-stroke bg-white px-2 py-1 text-xs font-medium text-ink outline-none focus:border-brand-300"
                        />
                        <button
                          type="button"
                          onClick={() => removeColumn(colIdx)}
                          className="shrink-0 text-xs text-danger-500 hover:text-danger-700"
                        >
                          &times;
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="w-10 border-b border-stroke" />
                </tr>
              </thead>
              <tbody>
                {examples.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-t border-stroke">
                    {row.map((cell, colIdx) => (
                      <td key={colIdx} className="px-2 py-1">
                        <input
                          value={cell}
                          onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                          className="w-full rounded border border-stroke bg-white px-2 py-1 text-xs text-ink outline-none focus:border-brand-300"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => removeRow(rowIdx)}
                        className="text-xs text-danger-500 hover:text-danger-700"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={addColumn}>
            + Column
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={addRow}
            disabled={examples.columns.length === 0}
          >
            + Row
          </Button>
        </div>
      </div>
    </div>
  );
}
