import { describe, expect, it } from "vitest";
import { documentAnswerSchema, riskItemSchema, userContextSchema } from "@/lib/schemas";

describe("public schemas", () => {
  it("requires exactly two user priorities", () => {
    expect(() =>
      userContextSchema.parse({
        discipline: "developer",
        contractValue: "under_50k",
        clientLocation: "india",
        status: "draft",
        priorities: ["prompt_payment"],
      }),
    ).toThrow();
  });

  it("rejects findings without page-grounded evidence", () => {
    expect(() =>
      riskItemSchema.parse({
        id: "bad-risk",
        category: "payment",
        severity: "high",
        confidence: 1,
        page: 0,
        quote: "",
        title: "Unsupported",
        explanation: "No evidence",
        idealRequest: "Ask",
        fallback: "Fallback",
        lawyerQuestion: "Question",
      }),
    ).toThrow();
  });

  it("allows an explicitly uncertain answer with no evidence", () => {
    const answer = documentAnswerSchema.parse({
      answer: "The document does not say.",
      evidence: [],
      uncertainty: "No supporting clause was found.",
      suggestedFollowUp: null,
      recommendLawyer: false,
    });
    expect(answer.evidence).toEqual([]);
  });
});
