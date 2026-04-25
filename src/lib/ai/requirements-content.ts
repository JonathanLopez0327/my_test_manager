const REQUIREMENTS_JSON_START =
  /\{\s*"(overall_score|verdict|verdict_rationale|ambiguities|measurable_criteria|hard_to_test_parts|suggested_improvements)"\s*:/;

function stripTrailingJsonBlob(content: string): string {
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] !== "{") continue;
    const before = content.slice(0, i).trimEnd();
    if (!before) continue;
    const candidate = content.slice(i).trim();
    if (!candidate.endsWith("}")) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return before;
      }
    } catch {
      continue;
    }
  }

  const match = content.match(REQUIREMENTS_JSON_START);
  if (match && typeof match.index === "number" && match.index > 0) {
    const before = content.slice(0, match.index).trimEnd();
    if (before) return before;
  }

  return content;
}

export function normalizeRequirementsContent(raw: string): string {
  if (!raw) return raw;
  const stripped = stripTrailingJsonBlob(raw);
  return stripped.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}
