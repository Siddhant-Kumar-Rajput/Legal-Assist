"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  FileQuestion,
  Info,
  MessageSquareText,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { ContextForm } from "@/components/context-form";
import { answerSampleQuestion } from "@/lib/sample-analysis";
import {
  documentAnswerSchema,
  type AnalysisResult,
  type DocumentAnswer,
  type UserContext,
} from "@/lib/schemas";

type Tab = "snapshot" | "negotiate" | "ask" | "brief";

const tabLabels: Record<Tab, string> = {
  snapshot: "Snapshot",
  negotiate: "Negotiate",
  ask: "Ask the contract",
  brief: "Lawyer brief",
};

const factLabels: Record<keyof AnalysisResult["facts"], string> = {
  freelancer: "Freelancer",
  client: "Client",
  effectiveDate: "Effective date",
  fees: "Fees",
  paymentTerms: "Payment terms",
  term: "Term",
  termination: "Termination",
  governingLaw: "Governing law",
  disputeForum: "Dispute forum",
};

const categoryLabels: Record<string, string> = {
  payment: "Payment",
  scope_acceptance: "Scope and acceptance",
  ip_portfolio_ai: "IP, portfolio and AI",
  termination: "Termination",
  liability_indemnity: "Liability and indemnity",
  confidentiality_data: "Confidentiality and data",
  exclusivity_non_compete: "Exclusivity and non-compete",
  dispute_resolution: "Dispute resolution",
};

function buildBrief(result: AnalysisResult): string {
  const facts = Object.entries(result.facts)
    .map(([key, value]) => `- ${factLabels[key as keyof AnalysisResult["facts"]]}: ${value ?? "Not stated"}`)
    .join("\n");
  const moves = result.topMoves
    .map(
      (risk, index) =>
        `### ${index + 1}. ${risk.title}\n\n` +
        `- Evidence: “${risk.quote}” (page ${risk.page})\n` +
        `- Why it matters: ${risk.explanation}\n` +
        `- Ideal request: ${risk.idealRequest}\n` +
        `- Fallback: ${risk.fallback}\n` +
        `- Ask a lawyer: ${risk.lawyerQuestion}`,
    )
    .join("\n\n");
  return `# NegoBrief — Contract preparation brief\n\n> Informational assistance only. This brief is not legal advice.\n\n## Contract snapshot\n\n${facts}\n\n## Priority discussion points\n\n${moves}\n\n## Missing or unclear protections\n\n${result.missingClauses.map((item) => `- ${item}`).join("\n")}\n\n## Draft client message\n\n${result.clientMessage}\n`;
}

export function Workspace({
  result,
  context,
  onContextChange,
  source,
  file,
  onClose,
}: {
  result: AnalysisResult;
  context: UserContext;
  onContextChange: (context: UserContext) => void;
  source: "sample" | "live";
  file: File | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("negotiate");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<DocumentAnswer | null>(null);
  const [askBusy, setAskBusy] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const brief = useMemo(() => buildBrief(result), [result]);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(result.clientMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const downloadBrief = () => {
    const url = URL.createObjectURL(new Blob([brief], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "negobrief-contract-preparation.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const askQuestion = async (event: FormEvent) => {
    event.preventDefault();
    const cleaned = question.trim();
    if (cleaned.length < 3) return;
    setAskBusy(true);
    setAskError(null);
    setAnswer(null);
    try {
      if (source === "sample") {
        await new Promise((resolve) => window.setTimeout(resolve, 320));
        setAnswer(answerSampleQuestion(cleaned));
        return;
      }
      if (!file) throw new Error("The original PDF is no longer available. Please upload it again.");
      const form = new FormData();
      form.set("file", file);
      form.set("context", JSON.stringify(context));
      form.set("question", cleaned);
      const response = await fetch("/api/ask", { method: "POST", body: form });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error((data as { message?: string }).message ?? "The question could not be answered.");
      setAnswer(documentAnswerSchema.parse(data));
    } catch (cause) {
      setAskError(cause instanceof Error ? cause.message : "The question could not be answered.");
    } finally {
      setAskBusy(false);
    }
  };

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <button className="back-button" type="button" onClick={onClose}><ArrowLeft size={18} aria-hidden="true" /> New review</button>
        <div className="workspace-brand"><span className="wordmark-mark">N</span><span>NegoBrief</span></div>
        <span className={source === "sample" ? "source-badge" : "source-badge source-badge--live"}>
          {source === "sample" ? "Synthetic sample" : "Live analysis"}
        </span>
      </header>

      <div className="workspace-titlebar">
        <div>
          <p className="eyebrow">Your negotiation workspace</p>
          <h1>{result.facts.client ? `Reviewing ${result.facts.client}` : "Contract review"}</h1>
          <p>{result.summary}</p>
        </div>
        <div className="confidence-note"><ShieldAlert size={19} aria-hidden="true" /><span><strong>Information, not a verdict.</strong> Verify important terms with a qualified professional.</span></div>
      </div>

      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <div className="context-card">
            <div className="context-card-title"><span>Your context</span><small>Changes ranking instantly</small></div>
            <ContextForm context={context} onChange={onContextChange} compact />
          </div>
          <div className="top-moves-mini">
            <span>Priority moves</span>
            {result.topMoves.map((move, index) => (
              <button key={move.id} type="button" onClick={() => setTab("negotiate")}>
                <i>{index + 1}</i><span>{move.title}</span><strong>{move.score}</strong>
              </button>
            ))}
          </div>
        </aside>

        <section className="workspace-main" aria-label="Contract analysis">
          <div className="tabs" role="tablist" aria-label="Analysis views">
            {(Object.keys(tabLabels) as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                id={`tab-${item}`}
                aria-controls={`panel-${item}`}
                aria-selected={tab === item}
                tabIndex={tab === item ? 0 : -1}
                onClick={() => setTab(item)}
              >
                {tabLabels[item]}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
            {tab === "snapshot" && (
              <div className="snapshot-view">
                <div className="view-heading"><p className="eyebrow">The agreement at a glance</p><h2>What the contract says</h2></div>
                <dl className="fact-grid">
                  {Object.entries(result.facts).map(([key, value]) => (
                    <div key={key}><dt>{factLabels[key as keyof AnalysisResult["facts"]]}</dt><dd className={value ? "" : "fact-missing"}>{value ?? "Not stated"}</dd></div>
                  ))}
                </dl>
                <div className="missing-panel"><div><Info size={20} aria-hidden="true" /><h3>Missing or unclear protections</h3></div><ul>{result.missingClauses.map((item) => <li key={item}>{item}</li>)}</ul></div>
              </div>
            )}

            {tab === "negotiate" && (
              <div className="negotiate-view">
                <div className="view-heading"><p className="eyebrow">Personalized by your context</p><h2>The three moves that matter most</h2><p>Scores order the conversation. They do not measure legality or guarantee an outcome.</p></div>
                <div className="risk-accordions">
                  {result.topMoves.map((risk, index) => (
                    <details className={`risk-card risk-card--${risk.severity}`} key={risk.id} open={index === 0}>
                      <summary>
                        <span className="risk-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="risk-summary"><span><b className={`severity severity--${risk.severity}`}>{risk.severity} priority</b><small>{categoryLabels[risk.category]}</small></span><strong>{risk.title}</strong><em>{risk.personalization.join(" · ")}</em></span>
                        <span className="risk-score"><b>{risk.score}</b><small>relevance</small></span>
                        <ChevronDown className="risk-chevron" aria-hidden="true" />
                      </summary>
                      <div className="risk-detail">
                        <blockquote>“{risk.quote}”<cite>Page {risk.page} · {Math.round(risk.confidence * 100)}% extraction confidence</cite></blockquote>
                        <div className="impact-copy"><h3>Why this matters</h3><p>{risk.explanation}</p></div>
                        <div className="position-grid"><div><span>Ideal request</span><p>{risk.idealRequest}</p></div><div><span>Workable fallback</span><p>{risk.fallback}</p></div></div>
                        <div className="lawyer-question"><MessageSquareText size={18} aria-hidden="true" /><span><strong>Ask a lawyer</strong>{risk.lawyerQuestion}</span></div>
                      </div>
                    </details>
                  ))}
                </div>
                <section className="message-card"><div><p className="eyebrow">Ready-to-send starting point</p><h2>A calm note to your client</h2></div><pre>{result.clientMessage}</pre><button className="button button--dark" type="button" onClick={copyMessage}>{copied ? <Check size={18} aria-hidden="true" /> : <Clipboard size={18} aria-hidden="true" />}{copied ? "Copied" : "Copy message"}</button></section>
              </div>
            )}

            {tab === "ask" && (
              <div className="ask-view">
                <div className="view-heading"><p className="eyebrow">Answers tied to the document</p><h2>Ask before you assume</h2><p>Questions are answered only when the contract provides supporting evidence.</p></div>
                <form onSubmit={askQuestion} className="ask-form"><label htmlFor="contract-question">Your question</label><div><input id="contract-question" value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} placeholder="When does the client own my code?" /><button type="submit" disabled={askBusy || question.trim().length < 3}>{askBusy ? "Checking…" : "Ask"}</button></div><span>{question.length}/500</span></form>
                <div className="question-suggestions" aria-label="Suggested questions">{["When will I get paid?", "Who owns my reusable code?", "Is my liability capped?"].map((item) => <button type="button" key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div>
                {askError && <p className="form-error" role="alert">{askError}</p>}
                {answer && <article className="answer-card" aria-live="polite"><div className="answer-title"><FileQuestion size={22} aria-hidden="true" /><h3>Document-grounded answer</h3></div><p className="answer-copy">{answer.answer}</p>{answer.evidence.map((evidence, index) => <blockquote key={`${evidence.page}-${index}`}>“{evidence.quote}”<cite>Page {evidence.page}</cite></blockquote>)}{answer.uncertainty && <div className="uncertainty"><Info size={17} aria-hidden="true" /><span><strong>What is unclear</strong>{answer.uncertainty}</span></div>}{answer.suggestedFollowUp && <p className="follow-up"><strong>Try next:</strong> {answer.suggestedFollowUp}</p>}{answer.recommendLawyer && <p className="professional-note">This issue may materially affect rights, money, or liability. Consider professional review.</p>}</article>}
              </div>
            )}

            {tab === "brief" && (
              <div className="brief-view">
                <div className="view-heading"><p className="eyebrow">Prepared, not overwhelmed</p><h2>Your lawyer-ready brief</h2><p>A compact evidence pack that makes a professional consultation more focused.</p></div>
                <div className="brief-actions"><button className="button button--dark" type="button" onClick={downloadBrief}><Download size={18} aria-hidden="true" />Download Markdown</button><button className="button button--outline" type="button" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />Print brief</button></div>
                <article className="print-brief"><h1>NegoBrief contract preparation</h1><p className="print-disclaimer">Informational assistance only. This brief is not legal advice.</p><h2>Contract snapshot</h2><dl>{Object.entries(result.facts).map(([key, value]) => <div key={key}><dt>{factLabels[key as keyof AnalysisResult["facts"]]}</dt><dd>{value ?? "Not stated"}</dd></div>)}</dl><h2>Priority discussion points</h2>{result.topMoves.map((risk, index) => <section key={risk.id}><h3>{index + 1}. {risk.title}</h3><p><strong>Evidence:</strong> “{risk.quote}” (page {risk.page})</p><p><strong>Why it matters:</strong> {risk.explanation}</p><p><strong>Ideal request:</strong> {risk.idealRequest}</p><p><strong>Fallback:</strong> {risk.fallback}</p><p><strong>Question for counsel:</strong> {risk.lawyerQuestion}</p></section>)}</article>
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="sr-only" aria-live="polite">{copied ? "Client message copied to clipboard." : ""}</div>
    </main>
  );
}
