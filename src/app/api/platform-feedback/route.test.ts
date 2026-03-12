/** @jest-environment node */
import { POST } from "./route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    platformFeedback: {
      create: jest.fn(),
    },
  },
}));

type PrismaMock = {
  platformFeedback: {
    create: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;

describe("POST /api/platform-feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when payload is invalid", async () => {
    const response = await POST(
      new Request("http://localhost/api/platform-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating: 9,
          message: "short",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.platformFeedback.create).not.toHaveBeenCalled();
  });

  it("creates feedback and returns 201", async () => {
    prismaMock.platformFeedback.create.mockResolvedValue({ id: "feedback-1" });

    const response = await POST(
      new Request("http://localhost/api/platform-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Jane Doe",
          email: "jane@acme.com",
          rating: 5,
          message: "The platform helps our QA workflow a lot.",
        }),
      }),
    );

    const body = (await response.json()) as { ok: boolean; message: string };

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(prismaMock.platformFeedback.create).toHaveBeenCalledWith({
      data: {
        name: "Jane Doe",
        email: "jane@acme.com",
        rating: 5,
        message: "The platform helps our QA workflow a lot.",
      },
    });
  });

  it("returns 500 when persistence fails", async () => {
    prismaMock.platformFeedback.create.mockRejectedValue(new Error("db down"));

    const response = await POST(
      new Request("http://localhost/api/platform-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating: 4,
          message: "Solid product with room to improve reporting.",
        }),
      }),
    );

    const body = (await response.json()) as { ok: boolean; message: string };

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
  });
});

