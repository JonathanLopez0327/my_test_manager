const BASE = `https://api.keygen.sh/v1/accounts/${process.env.KEYGEN_ACCOUNT_ID}`;
const KEYGEN_TIMEOUT_MS = 5000;

function headers() {
  return {
    Authorization: `Bearer ${process.env.KEYGEN_API_TOKEN}`,
    "Content-Type": "application/vnd.api+json",
    Accept: "application/vnd.api+json",
  };
}

async function keygenFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(KEYGEN_TIMEOUT_MS),
  });
}

type KeygenQuotas = {
  maxProjects: number;
  maxMembers: number;
  maxTestCases: number;
  maxTestRuns: number;
  maxArtifactBytes: bigint;
  aiTokenLimitMonthly: number;
};

async function handleResponse(res: Response, context: string): Promise<unknown> {
  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`[keygen] ${context} failed (${res.status}): ${body}`);
  }
  return res.json();
}

export async function createKeygenUser(email: string, name: string): Promise<string> {
  const [firstName, ...rest] = name.trim().split(" ");
  const lastName = rest.join(" ") || firstName;

  const res = await keygenFetch(`/users`, {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "users",
        attributes: { email, firstName, lastName },
      },
    }),
  });

  const json = (await handleResponse(res, "createUser")) as { data: { id: string } };
  return json.data.id;
}

export async function createKeygenLicense(
  keygenUserId: string,
  policyId: string,
): Promise<string> {
  const res = await keygenFetch(`/licenses`, {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "licenses",
        relationships: {
          policy: { data: { type: "policies", id: policyId } },
          owner: { data: { type: "users", id: keygenUserId } },
        },
      },
    }),
  });

  const json = (await handleResponse(res, "createLicense")) as { data: { id: string } };
  return json.data.id;
}

export type KeygenLicenseStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "SUSPENDED"
  | "BANNED"
  | "UNKNOWN";

export type KeygenLicenseState = {
  status: KeygenLicenseStatus;
  expiry: Date | null;
};

export async function getLicenseState(licenseId: string): Promise<KeygenLicenseState> {
  const res = await keygenFetch(`/licenses/${licenseId}`, { method: "GET" });

  const json = (await handleResponse(res, "getLicenseState")) as {
    data: { attributes: { status?: string | null; expiry?: string | null } };
  };

  const rawStatus = (json.data.attributes.status ?? "").toUpperCase();
  const knownStatuses: readonly string[] = [
    "ACTIVE",
    "INACTIVE",
    "EXPIRING",
    "EXPIRED",
    "SUSPENDED",
    "BANNED",
  ];
  const status: KeygenLicenseStatus = knownStatuses.includes(rawStatus)
    ? (rawStatus as KeygenLicenseStatus)
    : "UNKNOWN";

  const expiryStr = json.data.attributes.expiry;
  const expiry = expiryStr ? new Date(expiryStr) : null;

  return { status, expiry };
}

export async function renewLicense(licenseId: string): Promise<KeygenLicenseState> {
  const res = await keygenFetch(`/licenses/${licenseId}/actions/renew`, {
    method: "POST",
  });

  const json = (await handleResponse(res, "renewLicense")) as {
    data: { attributes: { status?: string | null; expiry?: string | null } };
  };

  const rawStatus = (json.data.attributes.status ?? "").toUpperCase();
  const knownStatuses: readonly string[] = [
    "ACTIVE",
    "INACTIVE",
    "EXPIRING",
    "EXPIRED",
    "SUSPENDED",
    "BANNED",
  ];
  const status: KeygenLicenseStatus = knownStatuses.includes(rawStatus)
    ? (rawStatus as KeygenLicenseStatus)
    : "UNKNOWN";
  const expiryStr = json.data.attributes.expiry;
  const expiry = expiryStr ? new Date(expiryStr) : null;

  return { status, expiry };
}

function parseLicenseState(json: {
  data: { attributes: { status?: string | null; expiry?: string | null } };
}): KeygenLicenseState {
  const rawStatus = (json.data.attributes.status ?? "").toUpperCase();
  const knownStatuses: readonly string[] = [
    "ACTIVE",
    "INACTIVE",
    "EXPIRING",
    "EXPIRED",
    "SUSPENDED",
    "BANNED",
  ];
  const status: KeygenLicenseStatus = knownStatuses.includes(rawStatus)
    ? (rawStatus as KeygenLicenseStatus)
    : "UNKNOWN";
  const expiryStr = json.data.attributes.expiry;
  const expiry = expiryStr ? new Date(expiryStr) : null;
  return { status, expiry };
}

export async function suspendLicense(licenseId: string): Promise<KeygenLicenseState> {
  const res = await keygenFetch(`/licenses/${licenseId}/actions/suspend`, {
    method: "POST",
  });
  const json = (await handleResponse(res, "suspendLicense")) as {
    data: { attributes: { status?: string | null; expiry?: string | null } };
  };
  return parseLicenseState(json);
}

export async function deleteKeygenUser(keygenUserId: string): Promise<void> {
  const res = await keygenFetch(`/users/${keygenUserId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`[keygen] deleteUser failed (${res.status}): ${body}`);
  }
}

export async function deleteKeygenLicense(licenseId: string): Promise<void> {
  const res = await keygenFetch(`/licenses/${licenseId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`[keygen] deleteLicense failed (${res.status}): ${body}`);
  }
}

export async function reinstateLicense(licenseId: string): Promise<KeygenLicenseState> {
  const res = await keygenFetch(`/licenses/${licenseId}/actions/reinstate`, {
    method: "POST",
  });
  const json = (await handleResponse(res, "reinstateLicense")) as {
    data: { attributes: { status?: string | null; expiry?: string | null } };
  };
  return parseLicenseState(json);
}

export async function getLicenseQuotas(licenseId: string): Promise<KeygenQuotas> {
  // Keygen represents entitlements as a link-only relationship on licenses.
  // Even with ?include=entitlements the `included` array comes back empty, so we
  // hit the dedicated endpoint that returns policy-inherited + direct entitlements.
  const res = await keygenFetch(`/licenses/${licenseId}/entitlements?limit=100`, {
    method: "GET",
  });

  const json = (await handleResponse(res, "getLicenseQuotas")) as {
    data?: Array<{ type: string; attributes: { code: string; metadata?: Record<string, unknown> } }>;
  };

  const entitlements = (json.data ?? []).filter((i) => i.type === "entitlements");

  const defaults: KeygenQuotas = {
    maxProjects: 3,
    maxMembers: 5,
    maxTestCases: 200,
    maxTestRuns: 100,
    maxArtifactBytes: BigInt(524_288_000),
    aiTokenLimitMonthly: 250_000,
  };

  for (const e of entitlements) {
    const val = Number((e.attributes.metadata ?? {})["value"]);
    if (!Number.isFinite(val)) continue;
    if (e.attributes.code === "max_projects") defaults.maxProjects = val;
    if (e.attributes.code === "max_members") defaults.maxMembers = val;
    if (e.attributes.code === "max_test_cases") defaults.maxTestCases = val;
    if (e.attributes.code === "max_test_runs") defaults.maxTestRuns = val;
    if (e.attributes.code === "max_artifact_bytes") defaults.maxArtifactBytes = BigInt(Math.trunc(val));
    if (e.attributes.code === "ai_token_limit_monthly") defaults.aiTokenLimitMonthly = val;
  }

  return defaults;
}
