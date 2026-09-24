// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAnalysis } from "@/lib/sample-analysis";
import { defaultContext } from "@/lib/schemas";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function MockGoogleGenAI() {
    return {
      files: { upload: mocks.upload, delete: mocks.remove },
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
});
