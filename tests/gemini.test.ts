// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAnalysis } from "@/lib/sample-analysis";
import { defaultContext } from "@/lib/schemas";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function MockGoogleGenAI() {
    return { models: { generateContent: mocks.create } };
  }),
}));

import { analyzeWithGemini } from "@/lib/gemini";

describe("Gemini inline-PDF boundary", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-key");
    mocks.create.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("sends the PDF inline and validates a JSON response locally", async () => {
    mocks.create.mockResolvedValue({ text: JSON.stringify(sampleAnalysis) });

    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).resolves.toEqual(sampleAnalysis);

    const request = mocks.create.mock.calls[0][0];
    expect(request.config).toEqual({ responseMimeType: "application/json" });
    expect(request.contents[0].parts[0]).toEqual({
      inlineData: { data: "AQID", mimeType: "application/pdf" },
    });
  });

  it("rejects model output that cannot be verified", async () => {
    mocks.create.mockResolvedValue({ text: "not-json" });
    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).rejects.toMatchObject({ code: "INVALID_AI_RESPONSE", status: 502 });
  });

  it("normalizes harmless Gemini JSON variations before strict validation", async () => {
    const risk = sampleAnalysis.risks[0];
    mocks.create.mockResolvedValue({
      text: `\`\`\`json\n${JSON.stringify({
        summary: sampleAnalysis.summary,
        contractFacts: {
          freelancer: sampleAnalysis.facts.freelancer,
          client: sampleAnalysis.facts.client,
          payment_terms: sampleAnalysis.facts.paymentTerms,
        },
        riskItems: [{
          category: risk.category,
          severity: risk.severity.toUpperCase(),
          confidence: 99,
          page_number: String(risk.page),
          exact_quotation: risk.quote,
          title: risk.title,
          impact: risk.explanation,
          ideal_request: risk.idealRequest,
          fallback_position: risk.fallback,
          lawyer_question: risk.lawyerQuestion,
        }],
        missing_clauses: sampleAnalysis.missingClauses,
      })}\n\`\`\``,
    });

    const result = await analyzeWithGemini(
      new Uint8Array([1, 2, 3]),
      "test.pdf",
      defaultContext,
    );

    expect(result.facts.effectiveDate).toBeNull();
    expect(result.risks[0].confidence).toBe(0.99);
    expect(result.risks[0].page).toBe(risk.page);
    expect(result.risks[0].id).toBe(`${risk.category}-1`);
  });

  it("maps provider quota failures to a safe public error", async () => {
    mocks.create.mockRejectedValue(new Error("429 quota exceeded for project secret-project-id"));
    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).rejects.toMatchObject({ code: "AI_QUOTA", status: 429 });
  });

  it("reports a rejected API key without exposing provider details", async () => {
    mocks.create.mockRejectedValue(
      Object.assign(new Error("API key not valid: secret-provider-detail"), { status: 400 }),
    );

    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).rejects.toMatchObject({ code: "AI_AUTH_FAILED", status: 503 });
  });

  it("classifies permission and model-access failures", async () => {
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("Permission denied"), { status: 403 }));
    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).rejects.toMatchObject({ code: "AI_PERMISSION_DENIED", status: 503 });

    mocks.create.mockRejectedValueOnce(Object.assign(new Error("Model not found"), { status: 404 }));
    await expect(
      analyzeWithGemini(new Uint8Array([1, 2, 3]), "test.pdf", defaultContext),
    ).rejects.toMatchObject({ code: "AI_MODEL_UNAVAILABLE", status: 503 });
  });
});
