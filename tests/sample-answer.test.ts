import { describe, expect, it } from "vitest";
import { answerSampleQuestion } from "@/lib/sample-analysis";

describe("sample document Q&A", () => {
  it("answers supported questions with page evidence", () => {
    const answer = answerSampleQuestion("When will I get paid?");
    expect(answer.evidence[0]).toMatchObject({ page: 2 });
    expect(answer.answer).toContain("60 days");
  });

  it("states uncertainty instead of inventing an unsupported answer", () => {
    const answer = answerSampleQuestion("Does this cover health insurance?");
    expect(answer.evidence).toEqual([]);
    expect(answer.uncertainty).toBeTruthy();
  });
});
