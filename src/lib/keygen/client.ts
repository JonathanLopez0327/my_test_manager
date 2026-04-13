const BASE = `https://api.keygen.sh/v1/accounts/${process.env.KEYGEN_ACCOUNT_ID}`;

function headers() {
  return {
    Authorization: `Bearer ${process.env.KEYGEN_API_TOKEN}`,
    "Content-Type": "application/vnd.api+json",
    Accept: "application/vnd.api+json",
  };
}

type KeygenQuotas = {
  maxProjects: number;
  maxMembers: number;
  maxTestCases: number;
  maxTestRuns: number;
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

  const res = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      data: {
        type: "users",
        attributes: { email, firstName, lastName, role: "user" },
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
  const res = await fetch(`${BASE}/licenses`, {
    method: "POST",
    headers: headers(),
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

export async function getLicenseQuotas(licenseId: string): Promise<KeygenQuotas> {
  const res = await fetch(`${BASE}/licenses/${licenseId}?include=entitlements`, {
    method: "GET",
    headers: headers(),
  });

  const json = (await handleResponse(res, "getLicenseQuotas")) as {
    included?: Array<{ type: string; attributes: { code: string; metadata?: Record<string, unknown> } }>;
  };

  const entitlements = (json.included ?? []).filter((i) => i.type === "entitlements");

  const defaults: KeygenQuotas = {
    maxProjects: 3,
    maxMembers: 5,
    maxTestCases: 200,
    maxTestRuns: 100,
  };

  for (const e of entitlements) {
    const val = Number((e.attributes.metadata ?? {})["value"]);
    if (!Number.isFinite(val)) continue;
    if (e.attributes.code === "max_projects") defaults.maxProjects = val;
    if (e.attributes.code === "max_members") defaults.maxMembers = val;
    if (e.attributes.code === "max_test_cases") defaults.maxTestCases = val;
    if (e.attributes.code === "max_test_runs") defaults.maxTestRuns = val;
  }

  return defaults;
}
