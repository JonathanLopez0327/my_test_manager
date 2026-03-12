import { ArtifactType } from "@/generated/prisma/client";

// Central beta policy for artifact uploads to keep route handlers consistent.
export const MAX_ARTIFACT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const BETA_BLOCKED_TYPES = new Set<ArtifactType>(["video"]);

type ValidationCode =
  | "artifact_type_blocked_beta"
  | "artifact_size_required"
  | "artifact_size_invalid"
  | "artifact_size_limit_exceeded";

type ValidationSuccess = {
  ok: true;
  sizeBytes: bigint | null;
};

type ValidationFailure = {
  ok: false;
  code: ValidationCode;
  message: string;
};

export type ArtifactUploadValidationResult = ValidationSuccess | ValidationFailure;

export function validateArtifactUploadPolicy(input: {
  type: ArtifactType;
  sizeBytes?: unknown;
  requirePositiveSize: boolean;
}): ArtifactUploadValidationResult {
  if (BETA_BLOCKED_TYPES.has(input.type)) {
    return {
      ok: false,
      code: "artifact_type_blocked_beta",
      message: "Video uploads are disabled in beta.",
    };
  }

  const parsedSize = parseSizeBytes(input.sizeBytes);
  if (parsedSize === "invalid") {
    return {
      ok: false,
      code: "artifact_size_invalid",
      message: "Invalid artifact size.",
    };
  }

  if (input.requirePositiveSize && (!parsedSize || parsedSize <= BigInt(0))) {
    return {
      ok: false,
      code: "artifact_size_required",
      message: "File is required.",
    };
  }

  if (parsedSize && parsedSize > BigInt(MAX_ARTIFACT_SIZE_BYTES)) {
    return {
      ok: false,
      code: "artifact_size_limit_exceeded",
      message: "Artifact exceeds the 10 MB limit.",
    };
  }

  return {
    ok: true,
    sizeBytes: parsedSize,
  };
}

function parseSizeBytes(value: unknown): bigint | null | "invalid" {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "bigint") {
    return value >= BigInt(0) ? value : "invalid";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return "invalid";
    return BigInt(Math.round(value));
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return "invalid";
    return BigInt(Math.round(parsed));
  }

  return "invalid";
}

