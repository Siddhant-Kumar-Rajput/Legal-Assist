"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { ContextForm } from "@/components/context-form";
import type { UserContext } from "@/lib/schemas";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function Landing({
  context,
  onContextChange,
  onSample,
  onAnalyze,
  busy,
  error,
}: {
  context: UserContext;
  onContextChange: (context: UserContext) => void;
  onSample: () => void;
  onAnalyze: (file: File) => void;
  busy: boolean;
  error: string | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) return;
      gsap.from(".hero-reveal", {
        opacity: 0,
        y: 34,
        duration: 0.9,
        stagger: 0.1,
        ease: "power3.out",
      });
      gsap.fromTo(
        ".reveal-word",
        { opacity: 0.16 },
        {
          opacity: 1,
          stagger: 0.08,
          scrollTrigger: { trigger: ".manifesto", start: "top 78%", end: "bottom 55%", scrub: 1 },
        },
      );
      gsap.utils.toArray<HTMLElement>(".stack-card").forEach((card, index) => {
        gsap.to(card, {
          y: index * -18,
          scale: 1 - index * 0.018,
          scrollTrigger: {
            trigger: card,
            start: "top 78%",
            end: "top 28%",
            scrub: true,
          },
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="landing-shell">
      <header className="nav-wrap">
        <a className="wordmark" href="#top" aria-label="NegoBrief home">
          <span className="wordmark-mark">N</span>
          <span>NegoBrief</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#how">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <button className="nav-cta" type="button" onClick={onSample}>Open instant demo</button>
      </header>

      <main id="top" className="overflow-x-hidden w-full max-w-full">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="ambient ambient-one" />
          <div className="ambient ambient-two" />
          <p className="eyebrow hero-reveal">Built for independent professionals in India</p>
          <h1 id="hero-title" className="hero-reveal max-w-6xl">
            Know what to negotiate <span>before you sign.</span>
          </h1>
          <p className="hero-copy hero-reveal">
            NegoBrief turns a dense client contract into three evidence-backed moves, a practical fallback,
            and a calm message you can actually send.
          </p>
          <div className="hero-actions hero-reveal">
            <button className="button button--primary" type="button" onClick={onSample}>
              Try the instant demo <ArrowRight size={18} aria-hidden="true" />
            </button>
            <a className="button button--ghost" href="#review">Review my PDF</a>
          </div>
          <div className="hero-document hero-reveal" aria-hidden="true">
            <div className="document-topline"><span>Freelance services agreement</span><span>4 pages</span></div>
            <div className="document-body">
              <div className="document-lines"><i /><i /><i /><i /><i /></div>
              <div className="margin-note margin-note--one"><strong>Push back</strong><span>Payment starts only after undefined acceptance.</span></div>
              <div className="margin-note margin-note--two"><strong>Protect</strong><span>Keep reusable tools outside the IP transfer.</span></div>
            </div>
          </div>
        </section>

        <section className="ticker" aria-label="Contract areas reviewed">
          <div className="ticker-track">
            {["PAYMENT TERMS", "SCOPE CONTROL", "IP OWNERSHIP", "PORTFOLIO RIGHTS", "LIABILITY", "TERMINATION", "DISPUTES", "PAYMENT TERMS", "SCOPE CONTROL", "IP OWNERSHIP"].map((item, index) => (
              <span key={`${item}-${index}`}>{item}<i /></span>
            ))}
          </div>
        </section>

        <section id="review" className="review-section">
          <div className="review-intro">
            <p className="eyebrow">Start with your leverage</p>
            <h2>A contract means something different to every freelancer.</h2>
            <p>Tell us what matters, then use the sample or upload a private English PDF.</p>
          </div>
          <div className="review-panel">
            <ContextForm context={context} onChange={onContextChange} />
            <div className="source-actions">
              <button className="sample-source group" type="button" onClick={onSample} disabled={busy}>
                <span className="source-icon"><Sparkles aria-hidden="true" /></span>
                <span><strong>Use the instant sample</strong><small>No API key or waiting required</small></span>
                <ArrowRight className="source-arrow" aria-hidden="true" />
              </button>
              <label className="upload-source group">
                <span className="source-icon"><Upload aria-hidden="true" /></span>
                <span><strong>{file ? file.name : "Choose an English PDF"}</strong><small>Up to 10 MB and 80 pages</small></span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button
                className="button button--dark analyze-button"
                type="button"
                disabled={!file || busy}
                onClick={() => file && onAnalyze(file)}
              >
                {busy ? "Reading contract…" : "Analyze this contract"}
                {!busy && <FileSearch size={18} aria-hidden="true" />}
              </button>
              {error && <p className="form-error" role="alert">{error}</p>}
              <p className="privacy-inline"><LockKeyhole size={15} aria-hidden="true" /> No account. No database. Your file is deleted after each AI request.</p>
            </div>
          </div>
        </section>

        <section id="how" className="capability-section">
          <div className="section-heading">
            <p className="eyebrow">From dense terms to a clear conversation</p>
            <h2>Built for the moment between receiving a contract and replying to the client.</h2>
          </div>
          <div className="bento-grid">
            <article className="bento bento--wide group">
              <FileSearch size={30} aria-hidden="true" />
              <h3>Evidence, not vague warnings</h3>
              <p>Every finding carries the exact clause, page number, confidence, practical impact, and the missing detail that matters.</p>
              <div className="quote-fragment">“Payment shall be due within sixty days after written acceptance…” <span>Page 2</span></div>
            </article>
            <article className="bento bento--dark group">
              <Scale size={30} aria-hidden="true" />
              <h3>Personalized leverage</h3>
              <p>Priorities, deal value, contract stage, and client location change what rises to the top.</p>
              <div className="rank-visual"><span>01</span><i /><strong>IP before payment</strong></div>
              <div className="rank-visual"><span>02</span><i /><strong>Net 60 acceptance</strong></div>
              <div className="rank-visual"><span>03</span><i /><strong>Liability cap</strong></div>
            </article>
            <article className="bento group"><ShieldCheck size={28} aria-hidden="true" /><h3>Safer by design</h3><p>No legal verdicts, no invented facts, and uncertainty stays visible.</p></article>
            <article className="bento bento--lime group"><CheckCircle2 size={28} aria-hidden="true" /><h3>Ready to send</h3><p>Turn the top three asks into a measured client message, not a confrontational redline.</p></article>
            <article className="bento group"><LockKeyhole size={28} aria-hidden="true" /><h3>Ephemeral files</h3><p>The browser keeps your PDF in memory. The server keeps no document history.</p></article>
          </div>
        </section>

        <section className="manifesto" aria-label="Product principle">
          <p>
            {"A useful legal assistant should not sound certain. It should show its evidence, name what it cannot know, and help you ask a better question."
              .split(" ")
              .map((word, index) => <span className="reveal-word" key={`${word}-${index}`}>{word} </span>)}
          </p>
        </section>

        <section className="workflow-section">
          <div className="workflow-heading"><p className="eyebrow">A calmer way through the contract</p><h2>Three decisions. One prepared conversation.</h2></div>
          <div className="workflow-stack">
            {[
              ["Find the clause", "See the actual words, page, and missing protection instead of a mysterious score."],
              ["Choose the position", "Start with an ideal request and keep a commercially realistic fallback ready."],
              ["Send the brief", "Copy a measured client note or take a focused evidence pack to a lawyer."],
            ].map(([title, body], index) => (
              <article className="stack-card" key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>
            ))}
          </div>
        </section>

        <section id="privacy" className="final-cta">
          <p className="eyebrow">Your next reply can be clearer</p>
          <h2>Do not negotiate the whole contract. Negotiate what changes the deal.</h2>
          <button className="button button--primary" type="button" onClick={onSample}>Open the sample brief <ArrowRight size={18} aria-hidden="true" /></button>
          <p className="disclaimer">Informational assistance only. NegoBrief is not a law firm and does not provide legal advice.</p>
        </section>
      </main>
      <footer><span>NegoBrief</span><span>Designed for Indian freelancers</span><span>Working name — not trademark cleared</span></footer>
    </div>
  );
}
