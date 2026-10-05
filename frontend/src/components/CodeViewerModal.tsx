// ABOUTME: Modal for reviewing generated/modified test code before applying.
// ABOUTME: Shows side-by-side diff for modifications, full code view for new files.

"use client";

import type { GeneratedScript } from "@/types";

interface CodeViewerModalProps {
  script: GeneratedScript;
  onClose: () => void;
  onApply: (scriptId: string) => void;
  onReject: (scriptId: string) => void;
  applying: boolean;
}

export default function CodeViewerModal({
  script,
  onClose,
  onApply,
  onReject,
  applying,
}: CodeViewerModalProps) {
  const isModification = script.action === "modify" || script.action === "append";
  const actionLabel =
    script.action === "modify"
      ? "Modified"
      : script.action === "append"
        ? "Appended"
        : "New File";

  const statusColors: Record<string, string> = {
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    applied:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected:
      "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-6xl max-h-[90vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">Code Review</h2>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium">
              {actionLabel}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[script.status] ?? ""}`}
            >
              {script.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* File path */}
        <div className="px-6 py-2 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            {script.file_path}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {isModification && script.original_content ? (
            <div className="flex h-full min-h-0">
              {/* Original */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0 border-r border-zinc-200 dark:border-zinc-700">
                <div className="px-4 py-2 bg-red-50 dark:bg-red-950 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
                  <p className="text-xs font-medium text-red-700 dark:text-red-300">
                    Original
                  </p>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <pre className="p-4 text-xs font-mono text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre">
                    {script.original_content}
                  </pre>
                </div>
              </div>
              {/* Generated */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="px-4 py-2 bg-green-50 dark:bg-green-950 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
                  <p className="text-xs font-medium text-green-700 dark:text-green-300">
                    Generated
                  </p>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <pre className="p-4 text-xs font-mono text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre">
                    {script.generated_content}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <pre className="p-6 text-xs font-mono text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre">
                {script.generated_content}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          {script.status === "pending" && (
            <>
              <button
                onClick={() => onReject(script.id)}
                disabled={applying}
                className="rounded-lg border border-red-200 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => onApply(script.id)}
                disabled={applying}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {applying ? "Applying..." : "Apply to Repo"}
              </button>
            </>
          )}
          {script.status !== "pending" && (
            <button
              onClick={onClose}
              className="rounded-lg bg-zinc-200 dark:bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
