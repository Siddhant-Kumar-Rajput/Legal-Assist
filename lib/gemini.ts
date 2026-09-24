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

type GeminiFile = { name?: string; uri?: string; mimeType?: string; mime_type?: string };

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

function readOutputText(interaction: unknown): string {
  const value = interaction as { outputText?: string; output_text?: string };
  const text = value.outputText ?? value.output_text;
  if (!text) throw new Error("Gemini returned no output text");
  return text;
}

async function withTemporaryPdf<T>(
  bytes: Uint8Array,
  filename: string,
  run: (client: GoogleGenAI, file: Required<Pick<GeminiFile, "uri">> & GeminiFile) => Promise<T>,
): Promise<T> {
  const client = getClient();
  let uploaded: GeminiFile | undefined;
  try {
    uploaded = await client.files.upload({
      file: new Blob([Buffer.from(bytes)], { type: "application/pdf" }),
      config: { displayName: filename, mimeType: "application/pdf" },
    });
    if (!uploaded.uri) throw new Error("Gemini upload did not return a file URI");
    return await run(client, uploaded as Required<Pick<GeminiFile, "uri">> & GeminiFile);
  } finally {
    if (uploaded?.name) {
      try {
        await client.files.delete({ name: uploaded.name });
      } catch {
        // Cleanup is best-effort. Gemini also expires uploaded files automatically.
      }
    }
  }
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
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("quota") || message.includes("429")) {
    throw new PublicApiError(429, "AI_QUOTA", "The AI service is busy or over quota. Try the sample or retry later.");
  }
  if (message.includes("timeout") || message.includes("deadline")) {
    throw new PublicApiError(504, "AI_TIMEOUT", "The document took too long to analyze. Please try again.");
  }
  throw new PublicApiError(502, "AI_UNAVAILABLE", "Live analysis is temporarily unavailable.");
}

export async function analyzeWithGemini(
  bytes: Uint8Array,
  filename: string,
  context: UserContext,
): Promise<ExtractedAnalysis> {
  try {
    return await withTemporaryPdf(bytes, filename, async (client, file) => {
      const interaction = await client.interactions.create({
        model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
        input: [
          { type: "document", uri: file.uri, mime_type: file.mimeType ?? file.mime_type ?? "application/pdf" },
          { type: "text", text: analysisPrompt(context) },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: z.toJSONSchema(extractedAnalysisSchema),
        },
      });
      return extractedAnalysisSchema.parse(JSON.parse(readOutputText(interaction)));
    });
  } catch (error) {
    return mapProviderError(error);
  }
}

export async function askWithGemini(
  bytes: Uint8Array,
  filename: string,
  question: string,
  context: UserContext,
): Promise<DocumentAnswer> {
  try {
    return await withTemporaryPdf(bytes, filename, async (client, file) => {
      const interaction = await client.interactions.create({
        model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
        input: [
          { type: "document", uri: file.uri, mime_type: file.mimeType ?? file.mime_type ?? "application/pdf" },
          { type: "text", text: questionPrompt(question, context) },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: z.toJSONSchema(documentAnswerSchema),
        },
      });
      return documentAnswerSchema.parse(JSON.parse(readOutputText(interaction)));
    });
  } catch (error) {
    return mapProviderError(error);
  }
}
