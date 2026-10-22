// ABOUTME: Settings page for configuring the LLM provider, API key, and model.
// ABOUTME: Connection must be tested successfully before settings can be saved.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSettings, updateSettings, testLLMConnection } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  {
    value: "openai_compatible",
    label: "OpenAI-Compatible (PortKey, Azure, LiteLLM, Ollama, etc.)",
  },
];

const MODEL_PLACEHOLDERS: Record<string, string> = {
  anthropic:
    "e.g. claude-sonnet-4-20250514, claude-haiku-4-20250514, claude-opus-4-20250514",
  openai: "e.g. gpt-4o, gpt-4o-mini, gpt-4-turbo",
  openai_compatible: "Enter the model name for your provider",
};

const BASE_URL_PLACEHOLDERS: Record<string, string> = {
  anthropic: "Leave empty for default Anthropic API",
  openai: "Leave empty for default OpenAI API",
  openai_compatible: "https://api.portkey.ai/v1 or your provider URL",
};

export default function SettingsPage() {
  const [provider, setProvider] = useState("anthropic");
  const [baseUrl, setBaseUrl] = useState("");
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
        setBaseUrl(s.llm_base_url);
        setModel(s.llm_model);
        setHasExistingKey(s.has_api_key);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function resetVerification() {
    setTestResult(null);
    setConnectionVerified(false);
  }

  function handleProviderChange(newProvider: string) {
    setProvider(newProvider);
    setBaseUrl("");
    setModel("");
    resetVerification();
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    setConnectionVerified(false);

    if (!apiKey && !hasExistingKey) {
      setTestResult({ success: false, message: "API key is required" });
      setTesting(false);
      return;
    }

    if (!apiKey && hasExistingKey) {
      setTestResult({
        success: false,
        message:
          "Enter your API key to test. The existing key is not shown for security.",
      });
      setTesting(false);
      return;
    }

    try {
      const result = await testLLMConnection({
        llm_provider: provider,
        llm_base_url: baseUrl,
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
        llm_base_url: baseUrl,
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

  const showBaseUrl =
    provider === "openai_compatible" || baseUrl.length > 0;

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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">LLM Settings</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
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

          {/* Base URL — always shown for openai_compatible, toggleable for others */}
          {showBaseUrl || provider === "openai_compatible" ? (
            <div>
              <label
                htmlFor="base-url"
                className="block text-sm font-medium mb-1.5"
              >
                Base URL
                {provider === "openai_compatible" && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              <input
                id="base-url"
                type="text"
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  resetVerification();
                }}
                placeholder={
                  BASE_URL_PLACEHOLDERS[provider] ?? "https://..."
                }
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {provider !== "openai_compatible" && (
                <p className="mt-1 text-xs text-zinc-400">
                  Optional — leave empty to use the default API endpoint.
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBaseUrl(" ")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Add custom Base URL (for proxies, self-hosted, etc.)
            </button>
          )}

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
                resetVerification();
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
            <input
              id="model"
              type="text"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                resetVerification();
              }}
              placeholder={
                MODEL_PLACEHOLDERS[provider] ?? "Enter model name..."
              }
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
