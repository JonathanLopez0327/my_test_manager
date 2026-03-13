import { validateArtifactUploadPolicy, MAX_ARTIFACT_SIZE_BYTES } from "./artifact-upload-policy";

describe("artifact-upload-policy", () => {
  it("accepts allowed artifact types under the size limit", () => {
    const result = validateArtifactUploadPolicy({
      type: "screenshot",
      sizeBytes: 9 * 1024 * 1024,
      requirePositiveSize: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sizeBytes).toBe(BigInt(9 * 1024 * 1024));
    }
  });

  it("rejects video uploads during beta", () => {
    const result = validateArtifactUploadPolicy({
      type: "video",
      sizeBytes: 1024,
      requirePositiveSize: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("artifact_type_blocked_beta");
      expect(result.message).toBe("Video uploads are disabled in beta.");
    }
  });

  it("rejects artifacts above the 10 MB size limit", () => {
    const result = validateArtifactUploadPolicy({
      type: "log",
      sizeBytes: MAX_ARTIFACT_SIZE_BYTES + 1,
      requirePositiveSize: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("artifact_size_limit_exceeded");
      expect(result.message).toBe("Artifact exceeds the 10 MB limit.");
    }
  });

  it("allows metadata artifacts with omitted size", () => {
    const result = validateArtifactUploadPolicy({
      type: "report",
      sizeBytes: undefined,
      requirePositiveSize: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sizeBytes).toBeNull();
    }
  });

  it("rejects invalid artifact size values", () => {
    const result = validateArtifactUploadPolicy({
      type: "other",
      sizeBytes: "not-a-number",
      requirePositiveSize: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("artifact_size_invalid");
      expect(result.message).toBe("Invalid artifact size.");
    }
  });
});
