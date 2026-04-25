/** @jest-environment node */

process.env.KEYGEN_ACCOUNT_ID = "acct-test";
process.env.KEYGEN_API_TOKEN = "tok-test";

// Use require so env vars land before the module-level BASE constant resolves.
const { getLicenseQuotas } = require("./client") as typeof import("./client");

const DEFAULTS = {
  maxProjects: 3,
  maxMembers: 5,
  maxTestCases: 200,
  maxTestRuns: 100,
  aiTokenLimitMonthly: 250_000,
};

function mockKeygenResponse(payload: unknown) {
  global.fetch = jest.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/vnd.api+json" },
    }),
  ) as unknown as typeof fetch;
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("getLicenseQuotas", () => {
  it("returns defaults when the response has no entitlements", async () => {
    mockKeygenResponse({ data: [] });

    await expect(getLicenseQuotas("lic-1")).resolves.toEqual(DEFAULTS);
  });

  it("returns defaults when data is missing", async () => {
    mockKeygenResponse({});

    await expect(getLicenseQuotas("lic-1")).resolves.toEqual(DEFAULTS);
  });

  it("parses all five entitlements when codes are lowercase", async () => {
    mockKeygenResponse({
      data: [
        { type: "entitlements", attributes: { code: "max_projects", metadata: { value: 10 } } },
        { type: "entitlements", attributes: { code: "max_members", metadata: { value: 25 } } },
        { type: "entitlements", attributes: { code: "max_test_cases", metadata: { value: 5000 } } },
        { type: "entitlements", attributes: { code: "max_test_runs", metadata: { value: 1000 } } },
        { type: "entitlements", attributes: { code: "ai_token_limit_monthly", metadata: { value: 5_000_000 } } },
      ],
    });

    await expect(getLicenseQuotas("lic-1")).resolves.toEqual({
      maxProjects: 10,
      maxMembers: 25,
      maxTestCases: 5000,
      maxTestRuns: 1000,
      aiTokenLimitMonthly: 5_000_000,
    });
  });

  it("falls back to defaults when the entitlement code is uppercase (known case-sensitive match)", async () => {
    // Documents current behaviour — Keygen may uppercase codes automatically.
    // If this test starts failing after a case-insensitive normalization fix,
    // update the expectation to use the parsed value instead of the default.
    mockKeygenResponse({
      data: [
        { type: "entitlements", attributes: { code: "AI_TOKEN_LIMIT_MONTHLY", metadata: { value: 999_999 } } },
      ],
    });

    const result = await getLicenseQuotas("lic-1");
    expect(result.aiTokenLimitMonthly).toBe(DEFAULTS.aiTokenLimitMonthly);
  });

  it("ignores entitlements whose metadata.value is missing or non-numeric", async () => {
    mockKeygenResponse({
      data: [
        { type: "entitlements", attributes: { code: "ai_token_limit_monthly", metadata: {} } },
        { type: "entitlements", attributes: { code: "max_projects", metadata: { value: "lots" } } },
      ],
    });

    await expect(getLicenseQuotas("lic-1")).resolves.toEqual(DEFAULTS);
  });

  it("ignores items that are not entitlements", async () => {
    mockKeygenResponse({
      data: [
        { type: "policies", attributes: { code: "ai_token_limit_monthly", metadata: { value: 999 } } },
      ],
    });

    await expect(getLicenseQuotas("lic-1")).resolves.toEqual(DEFAULTS);
  });

  it("calls the dedicated /entitlements endpoint with Authorization", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/vnd.api+json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await getLicenseQuotas("lic-xyz");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.keygen.sh/v1/accounts/acct-test/licenses/lic-xyz/entitlements?limit=100",
    );
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer tok-test",
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    });
  });

  it("throws a descriptive error when Keygen responds with non-ok", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("nope", { status: 500 }),
    ) as unknown as typeof fetch;

    await expect(getLicenseQuotas("lic-1")).rejects.toThrow(
      /getLicenseQuotas failed \(500\)/,
    );
  });
});
