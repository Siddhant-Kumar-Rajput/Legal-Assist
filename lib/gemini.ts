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
      return extractedAnalysisSchema.parse(JSON.parse(readOutputText(response)));
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
      return documentAnswerSchema.parse(JSON.parse(readOutputText(response)));
    });
  } catch (error) {
    return mapProviderError(error);
  }
}
