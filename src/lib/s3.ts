import { S3Client } from "@aws-sdk/client-s3";

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_BUCKET = process.env.S3_BUCKET;
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL || S3_ENDPOINT;

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name} env var.`);
  }
  return value;
}

export function getS3Config() {
  return {
    endpoint: requireEnv(S3_ENDPOINT, "S3_ENDPOINT"),
    accessKeyId: requireEnv(S3_ACCESS_KEY, "S3_ACCESS_KEY"),
    secretAccessKey: requireEnv(S3_SECRET_KEY, "S3_SECRET_KEY"),
    region: S3_REGION,
    bucket: requireEnv(S3_BUCKET, "S3_BUCKET"),
    publicUrl: requireEnv(S3_PUBLIC_URL, "S3_PUBLIC_URL"),
  };
}

export function getS3Client() {
  const config = getS3Config();
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

export function buildS3ObjectUrl(bucket: string, key: string) {
  const config = getS3Config();
  const base = config.publicUrl.replace(/\/$/, "");
  return `${base}/${bucket}/${encodeURI(key)}`;
}
