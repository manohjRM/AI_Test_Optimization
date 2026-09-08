// ABOUTME: Settings page for configuring the LLM provider, API key, and model.
// ABOUTME: Connection must be tested successfully before settings can be saved.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSettings, updateSettings, testLLMConnection } from "@/lib/api";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-haiku-4-20250514",
    "claude-opus-4-20250514",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
};

export default function SettingsPage() {
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [hasExistingKey, setHasExistingKey] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [connectionVerified, setConnectionVerified] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setProvider(s.llm_provider);
        setModel(s.llm_model);
        setHasExistingKey(s.has_api_key);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleProviderChange(newProvider: string) {
    setProvider(newProvider);
    setModel(MODEL_SUGGESTIONS[newProvider]?.[0] ?? "");
    setTestResult(null);
    setConnectionVerified(false);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    setConnectionVerified(false);

    const keyToTest = apiKey || (hasExistingKey ? "__existing__" : "");
    if (!keyToTest || keyToTest === "__existing__") {
      if (!apiKey && hasExistingKey) {
        setTestResult({
          success: false,
          message:
            "Enter your API key to test. The existing key is not shown for security.",
        });
        setTesting(false);
        return;
      }
      setTestResult({ success: false, message: "API key is required" });
      setTesting(false);
      return;
    }

    try {
      const result = await testLLMConnection({
        llm_provider: provider,
        llm_api_key: apiKey,
        llm_model: model,
      });
      setTestResult({ success: result.success, message: result.message });
      setConnectionVerified(result.success);
    } catch (err) {
      setTestResult({
        success: false,
        message:
          err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    try {
      await updateSettings({
        llm_provider: provider,
        llm_api_key: apiKey || undefined,
        llm_model: model,
      });
      setHasExistingKey(true);
      setApiKey("");
      setSaveMessage("Settings saved successfully");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Loading settings...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1">
          <Link
            href="/"
            className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Dashboard
          </Link>
          <span>/</span>
          <span>Settings</span>
        </div>
        <h1 className="text-xl font-bold">LLM Settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Configure the AI provider used for test analysis and generation.
        </p>
      </header>

      <div className="flex-1 p-6 max-w-xl">
        <div className="space-y-6">
          <div>
            <label
              htmlFor="provider"
              className="block text-sm font-medium mb-1.5"
            >
              Provider
            </label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="api-key"
              className="block text-sm font-medium mb-1.5"
            >
              API Key
              {hasExistingKey && !apiKey && (
                <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">
                  (key saved)
                </span>
              )}
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
                setConnectionVerified(false);
              }}
              placeholder={
                hasExistingKey
                  ? "Enter new key to update..."
                  : "Enter your API key..."
              }
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="model"
              className="block text-sm font-medium mb-1.5"
            >
              Model
            </label>
            <select
              id="model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setTestResult(null);
                setConnectionVerified(false);
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a model...</option>
              {(MODEL_SUGGESTIONS[provider] ?? []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={testing || !model}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {testResult && (
              <span
                className={`text-sm ${
                  testResult.success
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {testResult.message}
              </span>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={handleSave}
              disabled={saving || !connectionVerified}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            {!connectionVerified && (
              <span className="text-xs text-zinc-400">
                Test the connection before saving
              </span>
            )}
            {saveMessage && (
              <span
                className={`text-sm ${
                  saveMessage.includes("success")
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {saveMessage}
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
