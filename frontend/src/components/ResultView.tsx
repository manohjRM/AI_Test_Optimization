// ABOUTME: Displays the AI optimization result — generated script, explanation, and suggestions.
// ABOUTME: Renders the script in a code block with copy-to-clipboard support.

"use client";

import { useState } from "react";
import type { OptimizationResponse } from "@/types";

interface Props {
  result: OptimizationResponse;
}

export default function ResultView({ result }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    await navigator.clipboard.writeText(result.optimized_script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Generated Script</h2>
          <button
            onClick={copyToClipboard}
            className="text-xs px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="rounded-lg bg-zinc-900 text-zinc-100 p-4 text-sm font-mono overflow-x-auto">
          <code>{result.optimized_script}</code>
        </pre>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Explanation</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {result.explanation}
        </p>
      </div>

      {result.suggestions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Suggestions</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {result.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
