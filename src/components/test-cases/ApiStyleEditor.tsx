"use client";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { ApiRequest, ApiExpectedResponse, KeyValuePair } from "./types";

type ApiStyleEditorProps = {
  request: ApiRequest;
  expectedResponse: ApiExpectedResponse;
  onUpdateRequest: (request: ApiRequest) => void;
  onUpdateResponse: (response: ApiExpectedResponse) => void;
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function KeyValueEditor({
  label,
  pairs,
  onChange,
}: {
  label: string;
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
}) {
  const addPair = () => onChange([...pairs, { key: "", value: "" }]);
  const removePair = (index: number) => onChange(pairs.filter((_, i) => i !== index));
  const updatePair = (index: number, field: "key" | "value", val: string) => {
    onChange(pairs.map((p, i) => (i === index ? { ...p, [field]: val } : p)));
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-ink/60">{label}</span>
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            value={pair.key}
            onChange={(e) => updatePair(idx, "key", e.target.value)}
            placeholder="Key"
            className="w-1/3 rounded border border-stroke bg-surface-elevated dark:bg-surface-muted px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-300"
          />
          <input
            value={pair.value}
            onChange={(e) => updatePair(idx, "value", e.target.value)}
            placeholder="Value"
            className="flex-1 rounded border border-stroke bg-surface-elevated dark:bg-surface-muted px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-300"
          />
          <button
            type="button"
            onClick={() => removePair(idx)}
            className="text-xs text-danger-500 hover:text-danger-700"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addPair}
        className="text-xs text-brand-600 hover:text-brand-700"
      >
        + Add {label.toLowerCase().replace("headers", "header")}
      </button>
    </div>
  );
}

export function ApiStyleEditor({
  request,
  expectedResponse,
  onUpdateRequest,
  onUpdateResponse,
}: ApiStyleEditorProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Request section */}
      <div className="flex flex-col gap-3 rounded-lg border border-stroke bg-gray-50 p-3">
        <label className="text-sm font-semibold text-ink">Request</label>

        <div className="flex gap-2">
          <select
            value={request.method}
            onChange={(e) => onUpdateRequest({ ...request, method: e.target.value })}
            className="h-9 rounded border border-stroke bg-surface-elevated dark:bg-surface-muted px-2 text-sm font-medium text-ink"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <Input
            value={request.endpoint}
            onChange={(e) => onUpdateRequest({ ...request, endpoint: e.target.value })}
            placeholder="/api/users/:id"
            className="flex-1"
          />
        </div>

        <KeyValueEditor
          label="Headers"
          pairs={request.headers}
          onChange={(headers) => onUpdateRequest({ ...request, headers })}
        />

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink/60">Body</span>
          <textarea
            value={request.body}
            onChange={(e) => onUpdateRequest({ ...request, body: e.target.value })}
            placeholder='{"name": "John"}'
            className="min-h-[60px] w-full rounded border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 py-2 text-xs font-mono text-ink outline-none focus:border-brand-300"
          />
        </div>
      </div>

      {/* Expected Response section */}
      <div className="flex flex-col gap-3 rounded-lg border border-stroke bg-gray-50 p-3">
        <label className="text-sm font-semibold text-ink">Expected Response</label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink/60">Status</span>
          <Input
            value={expectedResponse.status}
            onChange={(e) => onUpdateResponse({ ...expectedResponse, status: e.target.value })}
            placeholder="200"
          />
        </div>

        <KeyValueEditor
          label="Headers"
          pairs={expectedResponse.headers}
          onChange={(headers) => onUpdateResponse({ ...expectedResponse, headers })}
        />

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink/60">Body</span>
          <textarea
            value={expectedResponse.body}
            onChange={(e) => onUpdateResponse({ ...expectedResponse, body: e.target.value })}
            placeholder='{"id": 1, "name": "John"}'
            className="min-h-[60px] w-full rounded border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 py-2 text-xs font-mono text-ink outline-none focus:border-brand-300"
          />
        </div>
      </div>
    </div>
  );
}
