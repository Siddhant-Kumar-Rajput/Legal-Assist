"use client";

import { useMemo, useState } from "react";
import { Landing } from "@/components/landing";
import { Workspace } from "@/components/workspace";
import { finalizeAnalysis } from "@/lib/ranking";
import { sampleAnalysis } from "@/lib/sample-analysis";
import {
  analysisResultSchema,
  defaultContext,
  riskItemSchema,
  type ExtractedAnalysis,
  type UserContext,
} from "@/lib/schemas";

export function NegoBriefApp() {
  const [context, setContext] = useState<UserContext>(defaultContext);
  const [baseAnalysis, setBaseAnalysis] = useState<ExtractedAnalysis | null>(null);
  const [source, setSource] = useState<"sample" | "live">("sample");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(
    () => (baseAnalysis ? finalizeAnalysis(baseAnalysis, context) : null),
    [baseAnalysis, context],
  );

  const useSample = () => {
    setError(null);
    setSource("sample");
    setFile(null);
    setBaseAnalysis(sampleAnalysis);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const analyze = async (selectedFile: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", selectedFile);
      form.set("context", JSON.stringify(context));
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data: unknown = await response.json();
      if (!response.ok) {
        const failure = data as { message?: string };
        throw new Error(failure.message ?? "The contract could not be analyzed.");
      }
      const parsed = analysisResultSchema.parse(data);
      const extracted: ExtractedAnalysis = {
        summary: parsed.summary,
        facts: parsed.facts,
        risks: parsed.risks.map((risk) => riskItemSchema.parse(risk)),
        missingClauses: parsed.missingClauses,
      };
      setSource("live");
      setFile(selectedFile);
      setBaseAnalysis(extracted);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The contract could not be analyzed.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Workspace
        result={result}
        context={context}
        onContextChange={setContext}
        source={source}
        file={file}
        onClose={() => {
          setBaseAnalysis(null);
          setFile(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <Landing
      context={context}
      onContextChange={setContext}
      onSample={useSample}
      onAnalyze={analyze}
      busy={busy}
      error={error}
    />
  );
}
