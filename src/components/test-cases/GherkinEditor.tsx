"use client";

import { Button } from "../ui/Button";
import type { GherkinKeyword } from "./types";

type ClauseItem = { id: string; keyword: GherkinKeyword; text: string };

type GherkinEditorProps = {
  clauses: ClauseItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: "keyword" | "text", value: string) => void;
};

const keywords: GherkinKeyword[] = ["Given", "When", "Then", "And"];

export function GherkinEditor({ clauses, onAdd, onRemove, onUpdate }: GherkinEditorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-ink">Gherkin Clauses</label>
      <div className="flex flex-col gap-3">
        {clauses.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-stroke bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <select
                value={item.keyword}
                onChange={(e) => onUpdate(item.id, "keyword", e.target.value)}
                className="h-8 rounded border border-stroke bg-white px-2 text-sm font-medium text-ink"
              >
                {keywords.map((kw) => (
                  <option key={kw} value={kw}>{kw}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-xs text-danger-500 hover:text-danger-700"
              >
                Delete
              </button>
            </div>
            <textarea
              value={item.text}
              onChange={(e) => onUpdate(item.id, "text", e.target.value)}
              placeholder="the user is on the login page"
              className="min-h-[50px] w-full rounded border border-stroke bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-300"
            />
          </div>
        ))}
        <Button type="button" variant="secondary" className="w-full" onClick={onAdd}>
          + Add clause
        </Button>
      </div>
    </div>
  );
}
