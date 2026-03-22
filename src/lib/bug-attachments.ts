import { ArtifactType } from "@/generated/prisma/client";
import { getPresignedUrl, getS3Config } from "@/lib/s3";

const ATTACHMENT_TYPE_VALUES: ArtifactType[] = [
  "screenshot",
  "video",
  "log",
  "report",
  "link",
  "other",
];

export function parseAttachmentType(value?: string | null): ArtifactType | null {
  if (!value) return null;
  return ATTACHMENT_TYPE_VALUES.includes(value as ArtifactType)
    ? (value as ArtifactType)
    : null;
}

export function inferAttachmentTypeFromMime(mimeType?: string | null): ArtifactType {
  const normalized = (mimeType ?? "").toLowerCase();
  if (normalized.startsWith("image/")) return "screenshot";
  if (normalized.startsWith("video/")) return "video";
  if (
    normalized.startsWith("text/")
    || normalized.includes("json")
    || normalized.includes("xml")
  ) {
    return "log";
  }
  return "other";
}

export function sanitizeAttachmentFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function serializeSizeBytes(value: bigint | number | string | null | undefined) {
  if (typeof value !== "bigint") return value ?? null;
  if (value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  return value.toString();
}

export async function maybeSignAttachmentUrl(url: string) {
  const { bucket, endpoint } = getS3Config("artifacts");
  const base = (process.env.S3_PUBLIC_URL ?? endpoint).replace(/\/$/, "");
  const bucketPrefix = `${base}/${bucket}/`;

  if (!url.startsWith(bucketPrefix)) {
    return url;
  }

  try {
    const encodedKey = url.slice(bucketPrefix.length);
    const key = decodeURI(encodedKey);
    return await getPresignedUrl("artifacts", key);
  } catch {
    return url;
  }
}
