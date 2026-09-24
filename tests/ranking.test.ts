import { describe, expect, it } from "vitest";
import { finalizeAnalysis, rankIssues } from "@/lib/ranking";
import { sampleAnalysis } from "@/lib/sample-analysis";
import { defaultContext } from "@/lib/schemas";

describe("deterministic risk ranking", () => {
  it("raises issues that match the freelancer's selected priorities", () => {
    const paymentFirst = rankIssues(sampleAnalysis, {
      ...defaultContext,
      priorities: ["prompt_payment", "scope_control"],
    });
    const ipFirst = rankIssues(sampleAnalysis, {
      ...defaultContext,
      priorities: ["ip_ownership", "portfolio_rights"],
    });

    expect(paymentFirst[0].category).toBe("payment");
    expect(ipFirst[0].category).toBe("ip_portfolio_ai");
    expect(paymentFirst.map((item) => item.quote)).toEqual(
      expect.arrayContaining(ipFirst.map((item) => item.quote)),
    );
  });

  it("returns exactly three moves and a message built from them", () => {
    const result = finalizeAnalysis(sampleAnalysis, defaultContext);
    expect(result.topMoves).toHaveLength(3);
    result.topMoves.forEach((move) => {
      expect(result.clientMessage).toContain(move.idealRequest);
      expect(move.personalization.length).toBeGreaterThan(0);
    });
  });

  it("adds cross-border relevance without changing extracted evidence", () => {
    const india = rankIssues(sampleAnalysis, defaultContext);
    const international = rankIssues(sampleAnalysis, {
      ...defaultContext,
      clientLocation: "international",
    });
    const indiaPayment = india.find((item) => item.category === "payment");
    const globalPayment = international.find((item) => item.category === "payment");
    expect(globalPayment?.score).toBe((indiaPayment?.score ?? 0) + 9);
    expect(globalPayment?.quote).toBe(indiaPayment?.quote);
  });
});
