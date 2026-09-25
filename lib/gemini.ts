import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  documentAnswerSchema,
  extractedAnalysisSchema,
  type DocumentAnswer,
  type ExtractedAnalysis,
  type UserContext,
} from "@/lib/schemas";
import { analysisPrompt, questionPrompt } from "@/lib/prompts";
import { PublicApiError } from "@/lib/pdf-validation";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new PublicApiError(
      503,
      "AI_NOT_CONFIGURED",
      "Live analysis is not configured. Try the instant sample instead.",
    );
  }
  return new GoogleGenAI({ apiKey });
}

function readOutputText(response: unknown): string {
  const value = response as { outputText?: string; output_text?: string; text?: string };
  const text = value.text ?? value.outputText ?? value.output_text;
  if (!text) throw new Error("Gemini returned no output text");
  return text;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nullableText(value: unknown): string | null {
  return textValue(value) ?? null;
}

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function normalizeSeverity(value: unknown): "high" | "medium" | "low" {
  const severity = textValue(value)?.toLowerCase();
  if (severity === "high" || severity === "critical") return "high";
  if (severity === "low") return "low";
  return "medium";
}

function normalizeConfidence(value: unknown): number {
  const confidence = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(confidence)) return 0.5;
  return Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence));
}

function normalizeExtractedAnalysis(value: unknown): unknown {
  const root = asRecord(value);
  const facts = asRecord(root.facts ?? root.contractFacts);
  const risksValue = root.risks ?? root.riskItems;
  const risks = Array.isArray(risksValue)
    ? risksValue.flatMap((item, index) => {
        const risk = asRecord(item);
        const category = textValue(risk.category)?.toLowerCase().replaceAll("-", "_");
        const quote = textValue(risk.quote ?? risk.exactQuote ?? risk.exact_quotation);
        const title = textValue(risk.title);
        const explanation = textValue(risk.explanation ?? risk.impact);
        const idealRequest = textValue(risk.idealRequest ?? risk.ideal_request);
        const fallback = textValue(risk.fallback ?? risk.fallbackPosition ?? risk.fallback_position);
        const lawyerQuestion = textValue(risk.lawyerQuestion ?? risk.lawyer_question);
        const page = Number(risk.page ?? risk.pageNumber ?? risk.page_number);

        if (
          !category ||
          !quote ||
          !title ||
          !explanation ||
          !idealRequest ||
          !fallback ||
          !lawyerQuestion ||
          !Number.isInteger(page) ||
          page < 1
        ) {
          return [];
        }

        return [{
          id: textValue(risk.id) ?? `${category}-${index + 1}`,
          category,
          severity: normalizeSeverity(risk.severity),
          confidence: normalizeConfidence(risk.confidence),
          page,
          quote,
          title,
          explanation,
          idealRequest,
          fallback,
          lawyerQuestion,
        }];
      })
    : [];

  const missingValue = root.missingClauses ?? root.missing_clauses;
  const missingClauses = Array.isArray(missingValue)
    ? missingValue.flatMap((item) => {
        const missing = textValue(item);
        return missing ? [missing] : [];
      })
    : [];

  return {
    summary: textValue(root.summary) ?? "The contract was analyzed for negotiation-relevant terms.",
    facts: {
      freelancer: nullableText(facts.freelancer),
      client: nullableText(facts.client),
      effectiveDate: nullableText(facts.effectiveDate ?? facts.effective_date),
      fees: nullableText(facts.fees),
      paymentTerms: nullableText(facts.paymentTerms ?? facts.payment_terms),
      term: nullableText(facts.term),
      termination: nullableText(facts.termination),
      governingLaw: nullableText(facts.governingLaw ?? facts.governing_law),
      disputeForum: nullableText(facts.disputeForum ?? facts.dispute_forum),
    },
    risks,
    missingClauses,
  };
}

function normalizeDocumentAnswer(value: unknown): unknown {
  const root = asRecord(value);
  const evidenceValue = root.evidence ?? root.supportingEvidence ?? root.supporting_evidence;
  const evidence = Array.isArray(evidenceValue)
    ? evidenceValue.flatMap((item) => {
        const entry = asRecord(item);
        const quote = textValue(entry.quote ?? entry.exactQuote ?? entry.exact_quotation);
        const page = Number(entry.page ?? entry.pageNumber ?? entry.page_number);
        return quote && Number.isInteger(page) && page > 0 ? [{ page, quote }] : [];
      })
    : [];

  const recommendLawyer = root.recommendLawyer ?? root.recommend_lawyer;
  return {
    answer: textValue(root.answer) ?? "",
    evidence,
    uncertainty: nullableText(root.uncertainty),
    suggestedFollowUp: nullableText(root.suggestedFollowUp ?? root.suggested_follow_up),
    recommendLawyer:
      typeof recommendLawyer === "boolean"
        ? recommendLawyer
        : textValue(recommendLawyer)?.toLowerCase() === "true",
  };
}

async function withInlinePdf<T>(
  bytes: Uint8Array,
  run: (client: GoogleGenAI, base64Pdf: string) => Promise<T>,
): Promise<T> {
  const client = getClient();
  return run(client, Buffer.from(bytes).toString("base64"));
}

function mapProviderError(error: unknown): never {
  if (error instanceof PublicApiError) throw error;
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    throw new PublicApiError(
      502,
      "INVALID_AI_RESPONSE",
      "The AI response could not be verified. Please try again.",
    );
  }
  const providerError = error as {
    code?: number | string;
    message?: string;
    name?: string;
    status?: number | string;
  };
  const message = providerError?.message?.toLowerCase() ?? "";
  const status = Number(providerError?.status ?? providerError?.code);

  // Keep provider details in server logs only. Do not log prompts, files, or credentials.
  console.error("Gemini provider request failed", {
    code: providerError?.code ?? null,
    name: providerError?.name ?? null,
    status: Number.isFinite(status) ? status : null,
  });

  if (status === 429 || message.includes("quota") || message.includes("429")) {
    throw new PublicApiError(429, "AI_QUOTA", "The AI service is busy or over quota. Try the sample or retry later.");
  }
  if (message.includes("timeout") || message.includes("deadline")) {
    throw new PublicApiError(504, "AI_TIMEOUT", "The document took too long to analyze. Please try again.");
  }
  if (
    status === 401 ||
    message.includes("api key not valid") ||
    message.includes("api_key_invalid") ||
    message.includes("unauthenticated")
  ) {
    throw new PublicApiError(
      503,
      "AI_AUTH_FAILED",
      "The Gemini API key was rejected. Check the production environment variable and redeploy.",
    );
  }
  if (status === 403 || message.includes("permission denied")) {
    throw new PublicApiError(
      503,
      "AI_PERMISSION_DENIED",
      "The Gemini project does not have permission for this request. Check API access and key restrictions.",
    );
  }
  if (status === 404 || (message.includes("model") && message.includes("not found"))) {
    throw new PublicApiError(
      503,
      "AI_MODEL_UNAVAILABLE",
      "The configured Gemini model is unavailable to this API key.",
    );
  }
  if (
    status === 400 &&
    (message.includes("response_format") ||
      message.includes("response format") ||
      message.includes("json schema") ||
      message.includes("schema"))
  ) {
    throw new PublicApiError(
      502,
      "AI_SCHEMA_REJECTED",
      "Gemini rejected the structured response format for this request.",
    );
  }
  if (
    status === 400 &&
    (message.includes("file") || message.includes("document") || message.includes("uri"))
  ) {
    throw new PublicApiError(
      502,
      "AI_DOCUMENT_REJECTED",
      "Gemini rejected the uploaded document reference.",
    );
  }
  if (status === 400 && message.includes("model")) {
    throw new PublicApiError(
      503,
      "AI_MODEL_UNAVAILABLE",
      "The configured Gemini model cannot process this request.",
    );
  }
  if (status === 400 || message.includes("invalid argument")) {
    throw new PublicApiError(
      502,
      "AI_REQUEST_REJECTED",
      "Gemini rejected the document request. Verify the configured model and try again.",
    );
  }
  throw new PublicApiError(502, "AI_UNAVAILABLE", "Live analysis is temporarily unavailable.");
}

export async function analyzeWithGemini(
  bytes: Uint8Array,
  _filename: string,
  context: UserContext,
): Promise<ExtractedAnalysis> {
  try {
    return await withInlinePdf(bytes, async (client, base64Pdf) => {
      const response = await client.models.generateContent({
        model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
        contents: [{
          role: "user",
          parts: [
            { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
            { text: analysisPrompt(context) },
          ],
        }],
        config: {
          responseMimeType: "application/json",
        },
      });
      return extractedAnalysisSchema.parse(
        normalizeExtractedAnalysis(parseModelJson(readOutputText(response))),
      );
    });
  } catch (error) {
    return mapProviderError(error);
  }
}

export async function askWithGemini(
  bytes: Uint8Array,
  _filename: string,
  question: string,
  context: UserContext,
): Promise<DocumentAnswer> {
  try {
    return await withInlinePdf(bytes, async (client, base64Pdf) => {
      const response = await client.models.generateContent({
        model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
        contents: [{
          role: "user",
          parts: [
            { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
            { text: questionPrompt(question, context) },
          ],
        }],
        config: {
          responseMimeType: "application/json",
        },
      });
      return documentAnswerSchema.parse(
        normalizeDocumentAnswer(parseModelJson(readOutputText(response))),
      );
    });
  } catch (error) {
    return mapProviderError(error);
  }
}
