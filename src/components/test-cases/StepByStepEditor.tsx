"use client";

import { Button } from "../ui/Button";

type StepItem = { id: string; step: string; expectedResult: string };

type StepByStepEditorProps = {
  steps: StepItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: "step" | "expectedResult", value: string) => void;
};

export function StepByStepEditor({ steps, onAdd, onRemove, onUpdate }: StepByStepEditorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-ink">Steps</label>
      <div className="flex flex-col gap-3">
        {steps.map((item, index) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-stroke bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-ink/60">Step {index + 1}</span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-xs text-danger-500 hover:text-danger-700"
              >
                Delete
              </button>
            </div>
            <textarea
              value={item.step}
              onChange={(e) => onUpdate(item.id, "step", e.target.value)}
              placeholder="Step description"
              className="min-h-[60px] w-full rounded border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 py-2 text-sm text-ink outline-none focus:border-brand-300"
            />
            <textarea
              value={item.expectedResult}
              onChange={(e) => onUpdate(item.id, "expectedResult", e.target.value)}
              placeholder="Expected result"
              className="min-h-[40px] w-full rounded border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 py-2 text-sm text-ink outline-none focus:border-brand-300"
            />
          </div>
        ))}
        <Button type="button" variant="secondary" className="w-full" onClick={onAdd}>
          + Add step
        </Button>
      </div>
    </div>
  );
}
