import { NextRequest, NextResponse } from "next/server";
import { askWithGemini } from "@/lib/gemini";
import { validatePdf, PublicApiError } from "@/lib/pdf-validation";
import { userContextSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const identifier = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!checkRateLimit(identifier)) {
      throw new PublicApiError(429, "RATE_LIMITED", "Too many requests. Please wait a minute and try again.");
    }
    const form = await request.formData();
    const file = form.get("file");
    const rawContext = form.get("context");
    const question = form.get("question");
    if (!(file instanceof File) || typeof rawContext !== "string" || typeof question !== "string") {
      throw new PublicApiError(400, "MISSING_INPUT", "A PDF, question, and freelancer context are required.");
    }
    const cleanedQuestion = question.trim();
    if (cleanedQuestion.length < 3 || cleanedQuestion.length > 500) {
      throw new PublicApiError(400, "INVALID_QUESTION", "Questions must be between 3 and 500 characters.");
    }
    const context = userContextSchema.parse(JSON.parse(rawContext));
    const bytes = await validatePdf(file);
    return NextResponse.json(await askWithGemini(bytes, file.name.slice(0, 120), cleanedQuestion, context));
  } catch (error) {
    if (error instanceof PublicApiError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "The request could not be processed safely." },
      { status: 400 },
    );
  }
}
