import {
  analysisResultSchema,
  type AnalysisResult,
  type ExtractedAnalysis,
  type Priority,
  type RiskCategory,
  type UserContext,
} from "@/lib/schemas";

const priorityCategories: Record<Priority, RiskCategory[]> = {
  prompt_payment: ["payment"],
  ip_ownership: ["ip_portfolio_ai"],
  portfolio_rights: ["ip_portfolio_ai", "confidentiality_data"],
  scope_control: ["scope_acceptance", "payment"],
  flexible_exit: ["termination"],
  liability_protection: ["liability_indemnity", "dispute_resolution"],
};

const severityScore = { high: 40, medium: 26, low: 12 } as const;

export function rankIssues(
  analysis: ExtractedAnalysis,
  context: UserContext,
): AnalysisResult["risks"] {
  return analysis.risks
    .map((risk, index) => {
      let score = severityScore[risk.severity] + Math.round(risk.confidence * 8);
      const personalization: string[] = [];

      const matchedPriorities = context.priorities.filter((priority) =>
        priorityCategories[priority].includes(risk.category),
      );
      if (matchedPriorities.length) {
        score += 18 * matchedPriorities.length;
        personalization.push("Matches your selected priorities");
      }

      if (
        ["2l_10l", "over_10l"].includes(context.contractValue) &&
        ["payment", "liability_indemnity", "termination"].includes(risk.category)
      ) {
        score += 8;
        personalization.push("Higher-value engagement");
      }

      if (
        context.clientLocation === "international" &&
        ["payment", "dispute_resolution", "confidentiality_data"].includes(risk.category)
      ) {
        score += 9;
        personalization.push("Cross-border client");
      }

      if (context.status === "signed") {
        if (["termination", "dispute_resolution", "liability_indemnity"].includes(risk.category)) {
          score += 7;
          personalization.push("Already-signed contract may need professional review");
        }
      } else {
        score += 3;
        personalization.push("Still negotiable before signing");
      }

      if (personalization.length === 0) {
        personalization.push("Material contract term");
      }

      return { risk: { ...risk, score, personalization }, index };
    })
    .sort((a, b) => b.risk.score - a.risk.score || a.index - b.index)
    .map((entry) => entry.risk);
}

export function buildClientMessage(topMoves: AnalysisResult["topMoves"]): string {
  const requests = topMoves
    .map((risk, index) => `${index + 1}. ${risk.title}: ${risk.idealRequest}`)
    .join("\n");

  return [
    "Hi,",
    "",
    "Thank you for sharing the agreement. I am looking forward to working together. Before I sign, could we align on these points so expectations are clear for both sides?",
    "",
    requests,
    "",
    "I am happy to discuss practical wording that works for both of us. Once these points are clarified, I should be able to move ahead quickly.",
    "",
    "Best,",
  ].join("\n");
}

export function finalizeAnalysis(
  extracted: ExtractedAnalysis,
  context: UserContext,
): AnalysisResult {
  const risks = rankIssues(extracted, context);
  const topMoves = risks.slice(0, 3);
  return analysisResultSchema.parse({
    ...extracted,
    risks,
    topMoves,
    clientMessage: buildClientMessage(topMoves),
  });
}
