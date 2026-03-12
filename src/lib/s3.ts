import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ── Tipo para distinguir los dos buckets ──────────────────────────────
export type S3BucketType = "artifacts" | "test-documents";

// ── Variables de entorno por bucket ───────────────────────────────────
const ENV = {
  artifacts: {
    endpoint: process.env.S3_ARTIFAC_BUCKET_ENDPOINT,
    accessKey: process.env.S3_ARTIFAC_BUCKET_ACCESS_KEY,
    secretKey: process.env.S3_ARTIFAC_BUCKET_SECRET_KEY,
    region: process.env.S3_ARTIFAC_BUCKET_REGION || "us-east-1",
    bucket: process.env.S3_ARTIFAC_BUCKET,
  },
  "test-documents": {
    endpoint: process.env.S3_TEST_DOCUMENTS_BUCKET_ENDPOINT,
    accessKey: process.env.S3_TEST_DOCUMENTS_BUCKET_ACCESS_KEY,
    secretKey: process.env.S3_TEST_DOCUMENTS_BUCKET_SECRET_KEY,
    region: process.env.S3_TEST_DOCUMENTS_BUCKET_REGION || "us-east-1",
    bucket: process.env.S3_TEST_DOCUMENTS_BUCKET,
  },
} as const;

const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL;

// ── Helpers ───────────────────────────────────────────────────────────
function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name} env var.`);
  }
  return value;
}

// ── Configuración por bucket ──────────────────────────────────────────
export function getS3Config(type: S3BucketType) {
  const env = ENV[type];
  const label = type === "artifacts" ? "S3_ARTIFAC_BUCKET" : "S3_TEST_DOCUMENTS_BUCKET";

  return {
    endpoint: requireEnv(env.endpoint, `${label}_ENDPOINT`),
    accessKeyId: requireEnv(env.accessKey, `${label}_ACCESS_KEY`),
    secretAccessKey: requireEnv(env.secretKey, `${label}_SECRET_KEY`),
    region: env.region,
    bucket: requireEnv(env.bucket, label),
  };
}

// ── Cliente S3 por bucket ─────────────────────────────────────────────
export function getS3Client(type: S3BucketType) {
  const config = getS3Config(type);
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

// ── URL pública de un objeto ──────────────────────────────────────────
export function buildS3ObjectUrl(type: S3BucketType, key: string) {
  const config = getS3Config(type);
  const base = (S3_PUBLIC_URL ?? config.endpoint).replace(/\/$/, "");
  return `${base}/${config.bucket}/${encodeURI(key)}`;
}

// ── URL pre-firmada ───────────────────────────────────────────────────
export async function getPresignedUrl(
  type: S3BucketType,
  key: string,
  expiresIn = 3600,
) {
  const client = getS3Client(type);
  const config = getS3Config(type);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}
