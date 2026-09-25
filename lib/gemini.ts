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

type GeminiFile = {
  name?: string;
  uri?: string;
  mimeType?: string;
  mime_type?: string;
  state?: string;
};

const FILE_PROCESSING_TIMEOUT_MS = 20_000;
const FILE_POLL_INTERVAL_MS = 750;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForFileProcessing(client: GoogleGenAI, uploaded: GeminiFile): Promise<GeminiFile> {
  if (!uploaded.name) return uploaded;

  const deadline = Date.now() + FILE_PROCESSING_TIMEOUT_MS;
  let file = (await client.files.get({ name: uploaded.name })) as GeminiFile;

  while (file.state === "PROCESSING") {
    if (Date.now() >= deadline) {
      throw new Error("Gemini file processing deadline exceeded");
    }
    await sleep(FILE_POLL_INTERVAL_MS);
    file = (await client.files.get({ name: uploaded.name })) as GeminiFile;
  }

  if (file.state === "FAILED") {
    throw new Error("Gemini could not process the uploaded PDF");
  }

  return { ...uploaded, ...file, uri: file.uri ?? uploaded.uri };
}

function toGeminiJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiJsonSchema);
  if (!schema || typeof schema !== "object") return schema;

  const unsupportedKeywords = new Set([
    "$schema",
    "exclusiveMaximum",
    "exclusiveMinimum",
    "maxLength",
    "minLength",
  ]);

  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => !unsupportedKeywords.has(key))
      .map(([key, value]) => [key, toGeminiJsonSchema(value)]),
  );
}

const analysisJsonSchema = toGeminiJsonSchema(z.toJSONSchema(extractedAnalysisSchema));
const answerJsonSchema = toGeminiJsonSchema(z.toJSONSchema(documentAnswerSchema));

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
    const readyFile = await waitForFileProcessing(client, uploaded);
    if (!readyFile.uri) throw new Error("Gemini upload did not return a file URI");
    return await run(client, readyFile as Required<Pick<GeminiFile, "uri">> & GeminiFile);
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
          schema: analysisJsonSchema,
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
          schema: answerJsonSchema,
        },
      });
      return documentAnswerSchema.parse(JSON.parse(readOutputText(interaction)));
    });
  } catch (error) {
    return mapProviderError(error);
  }
}
