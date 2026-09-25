// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAnalysis } from "@/lib/sample-analysis";
import { defaultContext } from "@/lib/schemas";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function MockGoogleGenAI() {
    return {
      files: { upload: mocks.upload, get: mocks.get, delete: mocks.remove },
      interactions: { create: mocks.create },
    };
  }),
}));

import { analyzeWithGemini } from "@/lib/gemini";

describe("Gemini temporary-file boundary", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-key");
    mocks.upload.mockReset().mockResolvedValue({
      name: "files/test",
      uri: "gemini://files/test",
      mimeType: "application/pdf",
    });
    mocks.get.mockReset().mockResolvedValue({
      name: "files/test",
      uri: "gemini://files/test",
      mimeType: "application/pdf",
      state: "ACTIVE",
    });
    mocks.remove.mockReset().mockResolvedValue(undefined);
    mocks.create.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("deletes the uploaded file after a valid structured response", async () => {
    mocks.create.mockResolvedValue({ output_text: JSON.stringify(sampleAnalysis) });
    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).resolves.toEqual(sampleAnalysis);
    expect(mocks.remove).toHaveBeenCalledWith({ name: "files/test" });
  });

  it("waits for an uploaded PDF to become active before analysis", async () => {
    mocks.get
      .mockResolvedValueOnce({
        name: "files/test",
        uri: "gemini://files/test",
        mimeType: "application/pdf",
        state: "PROCESSING",
      })
      .mockResolvedValueOnce({
        name: "files/test",
        uri: "gemini://files/test",
        mimeType: "application/pdf",
        state: "ACTIVE",
      });
    mocks.create.mockResolvedValue({ output_text: JSON.stringify(sampleAnalysis) });

    await analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext);

    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("sends only Gemini-supported JSON schema keywords", async () => {
    mocks.create.mockResolvedValue({ output_text: JSON.stringify(sampleAnalysis) });

    await analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext);

    const request = mocks.create.mock.calls[0][0];
    const serializedSchema = JSON.stringify(request.response_format.schema);
    expect(serializedSchema).not.toContain("$schema");
    expect(serializedSchema).not.toContain("minLength");
    expect(serializedSchema).not.toContain("exclusiveMinimum");
  });

  it("still deletes the file when model output cannot be verified", async () => {
    mocks.create.mockResolvedValue({ output_text: "not-json" });
    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).rejects.toMatchObject({ code: "INVALID_AI_RESPONSE", status: 502 });
    expect(mocks.remove).toHaveBeenCalledWith({ name: "files/test" });
  });

  it("maps provider quota failures to a safe public error and cleans up", async () => {
    mocks.create.mockRejectedValue(new Error("429 quota exceeded for project secret-project-id"));
    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).rejects.toMatchObject({ code: "AI_QUOTA", status: 429 });
    expect(mocks.remove).toHaveBeenCalledWith({ name: "files/test" });
  });

  it("reports a rejected API key without exposing provider details", async () => {
    mocks.upload.mockRejectedValue(
      Object.assign(new Error("API key not valid: secret-provider-detail"), { status: 400 }),
    );

    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).rejects.toMatchObject({ code: "AI_AUTH_FAILED", status: 503 });
  });

  it("classifies permission and model-access failures", async () => {
    mocks.upload.mockRejectedValueOnce(Object.assign(new Error("Permission denied"), { status: 403 }));
    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).rejects.toMatchObject({ code: "AI_PERMISSION_DENIED", status: 503 });

    mocks.upload.mockRejectedValueOnce(Object.assign(new Error("Model not found"), { status: 404 }));
    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).rejects.toMatchObject({ code: "AI_MODEL_UNAVAILABLE", status: 503 });
  });
});
