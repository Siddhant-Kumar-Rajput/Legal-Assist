// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validatePdf } from "@/lib/pdf-validation";

describe("PDF validation", () => {
  it("accepts the verified synthetic PDF fixture", async () => {
    const bytes = await readFile(path.join(process.cwd(), "output/pdf/software-freelancer-agreement.pdf"));
    const file = new File([bytes], "agreement.pdf", { type: "application/pdf" });
    await expect(validatePdf(file)).resolves.toBeInstanceOf(Uint8Array);
  });

  it("rejects a spoofed PDF", async () => {
    const file = new File(["not a PDF"], "agreement.pdf", { type: "application/pdf" });
    await expect(validatePdf(file)).rejects.toMatchObject({ code: "INVALID_PDF", status: 400 });
  });

  it("rejects the wrong MIME type", async () => {
    const file = new File(["%PDF-fake"], "agreement.txt", { type: "text/plain" });
    await expect(validatePdf(file)).rejects.toMatchObject({ code: "INVALID_FILE_TYPE" });
  });
});
