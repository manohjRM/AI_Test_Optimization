// ABOUTME: Form component for submitting test optimization requests.
// ABOUTME: Captures user input, existing script, framework, and language choices.

"use client";

import { useState } from "react";
import type { OptimizationRequest } from "@/types";

interface Props {
  onSubmit: (request: OptimizationRequest) => void;
  isLoading: boolean;
}

const FRAMEWORKS = ["pytest", "playwright", "selenium", "junit", "jest"];
const LANGUAGES = ["python", "typescript", "java", "javascript"];

export default function OptimizationForm({ onSubmit, isLoading }: Props) {
  const [userInput, setUserInput] = useState("");
  const [existingScript, setExistingScript] = useState("");
  const [framework, setFramework] = useState("pytest");
  const [language, setLanguage] = useState("python");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      user_input: userInput,
      existing_script: existingScript || undefined,
      framework,
      language,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="user-input"
          className="block text-sm font-medium mb-1.5"
        >
          What should the test do?
        </label>
        <textarea
          id="user-input"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Describe the test scenario in plain language..."
          rows={4}
          required
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="existing-script"
          className="block text-sm font-medium mb-1.5"
        >
          Existing script (optional)
        </label>
        <textarea
          id="existing-script"
          value={existingScript}
          onChange={(e) => setExistingScript(e.target.value)}
          placeholder="Paste an existing test script to optimize..."
          rows={6}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label
            htmlFor="framework"
            className="block text-sm font-medium mb-1.5"
          >
            Framework
          </label>
          <select
            id="framework"
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FRAMEWORKS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label
            htmlFor="language"
            className="block text-sm font-medium mb-1.5"
          >
            Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !userInput.trim()}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Optimizing..." : "Optimize Test Script"}
      </button>
    </form>
  );
}
