// ABOUTME: Home page — the main optimization interface.
// ABOUTME: Combines the input form and result view into a single-page workflow.

"use client";

import { useState } from "react";
import OptimizationForm from "@/components/OptimizationForm";
import ResultView from "@/components/ResultView";
import { optimize } from "@/lib/api";
import type { OptimizationRequest, OptimizationResponse } from "@/types";

export default function Home() {
  const [result, setResult] = useState<OptimizationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(request: OptimizationRequest) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await optimize(request);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <h1 className="text-xl font-bold">AI Test Optimization Agent</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Generate and optimize regression test scripts with AI
        </p>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800">
        <section className="flex-1 p-6 overflow-y-auto">
          <OptimizationForm onSubmit={handleSubmit} isLoading={isLoading} />
        </section>

        <section className="flex-1 p-6 overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {result && <ResultView result={result} />}
          {!result && !error && (
            <div className="flex items-center justify-center h-full text-sm text-zinc-400">
              Submit a request to see results here
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
