import { platformFeedbackSchema } from "@/lib/schemas/platform-feedback";

describe("platformFeedbackSchema", () => {
  it("accepts valid payload with optional empty name/email", () => {
    const parsed = platformFeedbackSchema.safeParse({
      name: "",
      email: "",
      rating: 5,
      message: "Great platform for our QA process.",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBeUndefined();
      expect(parsed.data.email).toBeUndefined();
    }
  });

  it("rejects invalid rating", () => {
    const parsed = platformFeedbackSchema.safeParse({
      name: "Jane",
      email: "jane@acme.com",
      rating: 6,
      message: "This should fail by rating.",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const parsed = platformFeedbackSchema.safeParse({
      name: "Jane",
      email: "invalid-email",
      rating: 4,
      message: "This should fail by invalid email.",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects short message", () => {
    const parsed = platformFeedbackSchema.safeParse({
      name: "Jane",
      email: "jane@acme.com",
      rating: 4,
      message: "Too short",
    });

    expect(parsed.success).toBe(false);
  });
});
