import { PDFDocument } from "pdf-lib";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 80;

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

export async function validatePdf(file: File): Promise<Uint8Array> {
  if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
    throw new PublicApiError(400, "INVALID_FILE_TYPE", "Please upload an English PDF file.");
  }
  if (file.size === 0) {
    throw new PublicApiError(400, "EMPTY_FILE", "The selected PDF is empty.");
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new PublicApiError(413, "FILE_TOO_LARGE", "The PDF must be 10 MB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-") {
    throw new PublicApiError(400, "INVALID_PDF", "The file does not contain a valid PDF signature.");
  }

  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    if (document.getPageCount() > MAX_PDF_PAGES) {
      throw new PublicApiError(
        413,
        "TOO_MANY_PAGES",
        `The PDF must contain ${MAX_PDF_PAGES} pages or fewer.`,
      );
    }
  } catch (error) {
    if (error instanceof PublicApiError) throw error;
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("encrypt")) {
      throw new PublicApiError(
        422,
        "PASSWORD_PROTECTED",
        "Password-protected PDFs are not supported. Please upload an unlocked copy.",
      );
    }
    throw new PublicApiError(422, "UNREADABLE_PDF", "The PDF could not be read safely.");
  }

  return bytes;
}
