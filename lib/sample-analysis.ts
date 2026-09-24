import type { DocumentAnswer, ExtractedAnalysis } from "@/lib/schemas";

export const sampleAnalysis: ExtractedAnalysis = {
  summary:
    "A twelve-week software engagement with clear fees, but the draft shifts payment timing, revision effort, intellectual-property control, and liability heavily toward the client.",
  facts: {
    freelancer: "Arjun Mehta",
    client: "Northstar Retail Private Limited",
    effectiveDate: "1 October 2026",
    fees: "INR 4,80,000 plus applicable taxes",
    paymentTerms: "Net 60 after acceptance; invoices may be withheld while deliverables are disputed",
    term: "Twelve weeks",
    termination: "Client may terminate on 5 days' notice; freelancer must give 30 days' notice",
    governingLaw: "Laws of India",
    disputeForum: "Exclusive courts at Bengaluru, Karnataka",
  },
  risks: [
    {
      id: "payment-net-60",
      category: "payment",
      severity: "high",
      confidence: 0.99,
      page: 2,
      quote:
        "Payment shall be due within sixty (60) days after Client's written acceptance of the applicable Deliverable.",
      title: "Payment depends on undefined acceptance",
      explanation:
        "The client controls when the payment clock begins, and the contract does not set a deadline for acceptance or require specific reasons for rejection.",
      idealRequest:
        "Use 15-day payment terms and deem a deliverable accepted within five business days unless the client lists material defects in writing.",
      fallback:
        "Keep Net 30, add a five-business-day review window, and require payment of every undisputed invoice amount.",
      lawyerQuestion:
        "Would a deemed-acceptance mechanism and late-payment interest be appropriate for this engagement?",
    },
    {
      id: "scope-unlimited",
      category: "scope_acceptance",
      severity: "high",
      confidence: 0.98,
      page: 2,
      quote:
        "Freelancer shall make all revisions requested by Client until Client is fully satisfied, at no additional charge.",
      title: "Unlimited unpaid revisions",
      explanation:
        "The phrase 'fully satisfied' is subjective and creates open-ended work beyond the planned twelve-week engagement.",
      idealRequest:
        "Include two revision rounds per milestone and price any additional work through a written change request.",
      fallback:
        "Set a reasonable-hours cap for included revisions and agree an hourly rate for work beyond it.",
      lawyerQuestion:
        "How should acceptance criteria and change-control wording be defined for software deliverables?",
    },
    {
      id: "ip-before-payment",
      category: "ip_portfolio_ai",
      severity: "high",
      confidence: 0.97,
      page: 3,
      quote:
        "All right, title and interest in the Work Product shall vest in Client immediately upon creation, whether or not payment has been made.",
      title: "IP transfers before payment",
      explanation:
        "Ownership moves to the client before the freelancer receives the agreed fee and may also capture reusable tools unless they are expressly excluded.",
      idealRequest:
        "Transfer ownership of paid-for deliverables only after full payment and retain ownership of pre-existing tools, libraries, and general know-how.",
      fallback:
        "Grant a conditional project-use licence until payment, then transfer the specifically listed final deliverables.",
      lawyerQuestion:
        "Does the definition of Work Product unintentionally include pre-existing code or reusable components?",
    },
    {
      id: "portfolio-ban",
      category: "ip_portfolio_ai",
      severity: "medium",
      confidence: 0.96,
      page: 3,
      quote:
        "Freelancer shall not display, describe or refer to the Services or Work Product in any portfolio or marketing material.",
      title: "No portfolio rights",
      explanation:
        "The restriction prevents the freelancer from even naming the engagement after the work becomes public.",
      idealRequest:
        "Permit a factual client reference and public screenshots after launch, subject to confidentiality and prior approval not to be unreasonably withheld.",
      fallback:
        "Allow a private case study shared only with prospective clients under confidentiality.",
      lawyerQuestion:
        "Can a narrow portfolio permission coexist with the confidentiality obligations?",
    },
    {
      id: "liability-unlimited",
      category: "liability_indemnity",
      severity: "high",
      confidence: 0.98,
      page: 4,
      quote:
        "Freelancer's liability under this Agreement shall be unlimited and shall include all indirect, special and consequential losses.",
      title: "Unlimited and indirect liability",
      explanation:
        "Potential exposure is not tied to the contract value and includes losses that can greatly exceed the freelancer's fees.",
      idealRequest:
        "Cap aggregate liability at fees paid under the agreement and exclude indirect, special, and consequential loss for both parties.",
      fallback:
        "Use a two-times-fees cap with narrowly defined exceptions for fraud or wilful misconduct.",
      lawyerQuestion:
        "Which liabilities, if any, should sit outside a mutual contractual cap?",
    },
    {
      id: "termination-asymmetry",
      category: "termination",
      severity: "medium",
      confidence: 0.95,
      page: 4,
      quote:
        "Client may terminate for convenience on five (5) days' notice; Freelancer may terminate only on thirty (30) days' notice.",
      title: "One-sided exit terms",
      explanation:
        "The client can end the engagement quickly while the freelancer remains committed for longer, with no stated cancellation payment.",
      idealRequest:
        "Use equal notice periods and pay for completed work, committed time, and a reasonable cancellation fee.",
      fallback:
        "Keep the shorter client notice but require payment for the current milestone and non-cancellable commitments.",
      lawyerQuestion:
        "What termination payment best reflects reserved capacity and completed work?",
    },
  ],
  missingClauses: [
    "No objective acceptance criteria or review deadline",
    "No change-request process for additional scope",
    "No late-payment interest or undisputed-amount obligation",
    "No carve-out for the freelancer's pre-existing materials",
  ],
};

export function answerSampleQuestion(question: string): DocumentAnswer {
  const normalized = question.toLowerCase();
  if (/(pay|paid|payment|invoice|accept)/.test(normalized)) {
    return {
      answer:
        "The contract says payment is due 60 days after written acceptance. Because it does not define a review deadline, the start of that 60-day period is controlled by the client.",
      evidence: [{ page: 2, quote: sampleAnalysis.risks[0].quote }],
      uncertainty:
        "The document does not explain how quickly the client must accept or reject a deliverable.",
      suggestedFollowUp: "Ask whether undisputed invoice amounts can be paid within 15 or 30 days.",
      recommendLawyer: false,
    };
  }
  if (/(owner|ownership|ip|code|portfolio)/.test(normalized)) {
    return {
      answer:
        "The draft transfers Work Product to the client immediately on creation, even before payment, and separately prevents portfolio use.",
      evidence: [
        { page: 3, quote: sampleAnalysis.risks[2].quote },
        { page: 3, quote: sampleAnalysis.risks[3].quote },
      ],
      uncertainty:
        "The draft does not clearly distinguish final deliverables from pre-existing tools or reusable code.",
      suggestedFollowUp: "Clarify ownership of pre-existing libraries and when final ownership transfers.",
      recommendLawyer: true,
    };
  }
  if (/(liab|indemn|loss|damage)/.test(normalized)) {
    return {
      answer:
        "The freelancer's liability is stated to be unlimited and includes indirect and consequential losses, so the exposure is not linked to the INR 4,80,000 fee.",
      evidence: [{ page: 4, quote: sampleAnalysis.risks[4].quote }],
      uncertainty: null,
      suggestedFollowUp: "Ask for a mutual cap tied to fees and exclusions for indirect losses.",
      recommendLawyer: true,
    };
  }
  return {
    answer:
      "The sample contract does not provide enough evidence to answer that question confidently.",
    evidence: [],
    uncertainty: "No directly supporting clause was found in the sample analysis.",
    suggestedFollowUp: "Try asking about payment, intellectual property, revisions, liability, or termination.",
    recommendLawyer: false,
  };
}
