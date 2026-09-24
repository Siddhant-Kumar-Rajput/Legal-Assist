import { z } from "zod";

export const disciplines = [
  "developer",
  "designer",
  "writer",
  "marketer",
  "consultant",
  "other",
] as const;

export const priorities = [
  "prompt_payment",
  "ip_ownership",
  "portfolio_rights",
  "scope_control",
  "flexible_exit",
  "liability_protection",
] as const;

export const categories = [
  "payment",
  "scope_acceptance",
  "ip_portfolio_ai",
  "termination",
  "liability_indemnity",
  "confidentiality_data",
  "exclusivity_non_compete",
  "dispute_resolution",
] as const;

export const userContextSchema = z.object({
  discipline: z.enum(disciplines),
  contractValue: z.enum(["under_50k", "50k_2l", "2l_10l", "over_10l"]),
  clientLocation: z.enum(["india", "international"]),
  status: z.enum(["draft", "signed"]),
  priorities: z.array(z.enum(priorities)).length(2),
});

export const contractFactsSchema = z.object({
  freelancer: z.string().nullable(),
  client: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  fees: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  term: z.string().nullable(),
  termination: z.string().nullable(),
  governingLaw: z.string().nullable(),
  disputeForum: z.string().nullable(),
});

export const riskItemSchema = z.object({
  id: z.string().min(1),
  category: z.enum(categories),
  severity: z.enum(["high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
  page: z.number().int().positive(),
  quote: z.string().min(1),
  title: z.string().min(1),
  explanation: z.string().min(1),
  idealRequest: z.string().min(1),
  fallback: z.string().min(1),
  lawyerQuestion: z.string().min(1),
});

export const extractedAnalysisSchema = z.object({
  summary: z.string().min(1),
  facts: contractFactsSchema,
  risks: z.array(riskItemSchema).min(1).max(16),
  missingClauses: z.array(z.string()).max(8),
});

export const rankedRiskItemSchema = riskItemSchema.extend({
  score: z.number(),
  personalization: z.array(z.string()).min(1),
});

export const analysisResultSchema = extractedAnalysisSchema.extend({
  risks: z.array(rankedRiskItemSchema),
  topMoves: z.array(rankedRiskItemSchema).max(3),
  clientMessage: z.string().min(1),
});

export const evidenceSchema = z.object({
  page: z.number().int().positive(),
  quote: z.string().min(1),
});

export const documentAnswerSchema = z.object({
  answer: z.string().min(1),
  evidence: z.array(evidenceSchema).max(5),
  uncertainty: z.string().nullable(),
  suggestedFollowUp: z.string().nullable(),
  recommendLawyer: z.boolean(),
});

export type UserContext = z.infer<typeof userContextSchema>;
export type Priority = UserContext["priorities"][number];
export type RiskCategory = (typeof categories)[number];
export type ExtractedAnalysis = z.infer<typeof extractedAnalysisSchema>;
export type RankedRiskItem = z.infer<typeof rankedRiskItemSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type DocumentAnswer = z.infer<typeof documentAnswerSchema>;

export const defaultContext: UserContext = {
  discipline: "developer",
  contractValue: "2l_10l",
  clientLocation: "india",
  status: "draft",
  priorities: ["prompt_payment", "ip_ownership"],
};
