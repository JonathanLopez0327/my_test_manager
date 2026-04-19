import { createHash, createPublicKey, verify as nodeVerify, type KeyObject } from "crypto";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function loadEd25519PublicKey(value: string): KeyObject {
  const trimmed = value.trim();

  if (trimmed.includes("-----BEGIN")) {
    const pem = trimmed.replace(/\\n/g, "\n");
    return createPublicKey({ key: pem, format: "pem" });
  }

  const hex = trimmed.replace(/\s+/g, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error("Ed25519 key must be PEM or 64-char hex");
  }

  const raw = Buffer.from(hex, "hex");
  const spki = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  return createPublicKey({ key: spki, format: "der", type: "spki" });
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

type SignatureParams = {
  keyid?: string;
  algorithm?: string;
  signature?: string;
  headers?: string;
};

function parseSignatureHeader(raw: string): SignatureParams {
  const out: SignatureParams = {};
  const re = /(keyid|algorithm|signature|headers)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    (out as Record<string, string>)[m[1]] = m[2];
  }
  return out;
}

function buildSigningString(
  method: string,
  path: string,
  host: string,
  date: string,
  digest: string,
  headersSpec: string,
): string | null {
  const parts = headersSpec.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const h of parts) {
    switch (h.toLowerCase()) {
      case "(request-target)":
        lines.push(`(request-target): ${method.toLowerCase()} ${path}`);
        break;
      case "host":
        lines.push(`host: ${host}`);
        break;
      case "date":
        lines.push(`date: ${date}`);
        break;
      case "digest":
        lines.push(`digest: ${digest}`);
        break;
      default:
        return null;
    }
  }
  return lines.join("\n");
}

export function verifyKeygenWebhook(params: {
  method: string;
  url: string;
  headers: Headers;
  rawBody: string;
  publicKeyPem: string;
  now?: Date;
}): VerifyResult {
  const { method, url, headers, rawBody, publicKeyPem } = params;
  const now = params.now ?? new Date();

  const signatureHeader = headers.get("keygen-signature");
  const digestHeader = headers.get("digest");
  const dateHeader = headers.get("date");
  const hostHeader = headers.get("host");

  if (!signatureHeader) return { ok: false, reason: "missing signature" };
  if (!digestHeader) return { ok: false, reason: "missing digest" };
  if (!dateHeader) return { ok: false, reason: "missing date" };
  if (!hostHeader) return { ok: false, reason: "missing host" };

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed.signature || !parsed.headers) {
    return { ok: false, reason: "malformed signature header" };
  }
  if (parsed.algorithm && parsed.algorithm.toLowerCase() !== "ed25519") {
    return { ok: false, reason: `unsupported algorithm: ${parsed.algorithm}` };
  }

  const expectedDigest = `sha-256=${createHash("sha256").update(rawBody).digest("base64")}`;
  if (digestHeader !== expectedDigest) {
    return { ok: false, reason: "digest mismatch" };
  }

  const dateMs = Date.parse(dateHeader);
  if (Number.isNaN(dateMs)) return { ok: false, reason: "invalid date" };
  if (Math.abs(now.getTime() - dateMs) > MAX_CLOCK_SKEW_MS) {
    return { ok: false, reason: "date skew too large" };
  }

  let path: string;
  try {
    const parsedUrl = new URL(url);
    path = parsedUrl.pathname + parsedUrl.search;
  } catch {
    return { ok: false, reason: "invalid request url" };
  }

  const signingString = buildSigningString(
    method,
    path,
    hostHeader,
    dateHeader,
    digestHeader,
    parsed.headers,
  );
  if (signingString === null) {
    return { ok: false, reason: "unsupported signed header" };
  }

  let publicKey: KeyObject;
  try {
    publicKey = loadEd25519PublicKey(publicKeyPem);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `invalid public key: ${detail}` };
  }

  const signatureBytes = Buffer.from(parsed.signature, "base64");
  const verified = nodeVerify(
    null,
    Buffer.from(signingString, "utf8"),
    publicKey,
    signatureBytes,
  );
  if (!verified) return { ok: false, reason: "bad signature" };

  return { ok: true };
}
