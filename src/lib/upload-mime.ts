import { ArtifactType } from "@/generated/prisma/client";

// Allowlists per artifact type. The client-supplied `file.type` is treated as
// untrusted: we always re-derive an effective content type from a magic-byte
// sniff and then check it against this list. Anything we cannot place
// confidently is stored as application/octet-stream and served as an
// attachment.

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const TEXT_TYPES = new Set([
  "text/plain",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "application/x-ndjson",
]);

const REPORT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/json",
  "text/csv",
  "application/xml",
  "text/xml",
]);

const GENERIC_TYPES = new Set<string>([
  ...IMAGE_TYPES,
  ...TEXT_TYPES,
  ...REPORT_TYPES,
  "application/zip",
  "application/octet-stream",
]);

const ALLOW_BY_TYPE: Record<ArtifactType, ReadonlySet<string>> = {
  screenshot: IMAGE_TYPES,
  video: VIDEO_TYPES,
  log: TEXT_TYPES,
  report: REPORT_TYPES,
  link: GENERIC_TYPES,
  other: GENERIC_TYPES,
};

// Inline-safe types are returned with `Content-Disposition: inline`. Anything
// else is forced to attachment to prevent the bucket from rendering attacker-
// controlled HTML/SVG/JS in the user's browser.
const INLINE_SAFE_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "application/pdf",
]);

export function isInlineSafeMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return INLINE_SAFE_TYPES.has(mime.toLowerCase());
}

// Magic-byte sniff. Covers the formats we accept; anything unknown returns
// null so the caller can fall back to application/octet-stream.
export function sniffMimeFromBytes(buffer: Buffer): string | null {
  if (buffer.length >= 8) {
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return "image/png";
    }
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return "image/bmp";
  }
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return "application/pdf";
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return "application/zip";
  }
  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return "video/mp4";
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "video/webm";
  }

  // Heuristic for plain text / JSON / XML / CSV: inspect the first 1KB.
  const head = buffer.slice(0, Math.min(buffer.length, 1024));
  let printable = 0;
  for (let i = 0; i < head.length; i += 1) {
    const byte = head[i];
    if (
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0d ||
      (byte >= 0x20 && byte <= 0x7e)
    ) {
      printable += 1;
    }
  }
  if (head.length > 0 && printable / head.length > 0.95) {
    const text = head.toString("utf8").trimStart();
    if (text.startsWith("{") || text.startsWith("[")) return "application/json";
    if (text.startsWith("<")) return "application/xml";
    return "text/plain";
  }

  return null;
}

export type MimeValidationOk = {
  ok: true;
  effectiveMime: string;
  inlineSafe: boolean;
};

export type MimeValidationFailure = {
  ok: false;
  message: string;
};

export type MimeValidationResult = MimeValidationOk | MimeValidationFailure;

export function validateUploadMime(input: {
  type: ArtifactType;
  buffer: Buffer;
}): MimeValidationResult {
  const sniffed = sniffMimeFromBytes(input.buffer);
  const effective = sniffed ?? "application/octet-stream";
  const allow = ALLOW_BY_TYPE[input.type];

  if (!allow.has(effective)) {
    return {
      ok: false,
      message: `File content (${effective}) is not allowed for ${input.type} uploads.`,
    };
  }

  return {
    ok: true,
    effectiveMime: effective,
    inlineSafe: isInlineSafeMime(effective),
  };
}

const FILENAME_UNSAFE = /[\r\n"\\]/g;
const FILENAME_PATH_PARTS = /[\\/]/g;

export function sanitizeContentDispositionFilename(name: string): string {
  return name
    .replace(FILENAME_PATH_PARTS, "_")
    .replace(FILENAME_UNSAFE, "_")
    .slice(0, 200) || "download";
}
