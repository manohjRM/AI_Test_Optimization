// ABOUTME: Modal for reviewing generated/modified test code before applying.
// ABOUTME: Shows unified git-style diff for modifications, full code view for new files.

"use client";

import { useMemo } from "react";
import type { GeneratedScript } from "@/types";

interface DiffLine {
  type: "same" | "add" | "remove";
  content: string;
  oldNum: number | null;
  newNum: number | null;
}

function computeUnifiedDiff(original: string, generated: string): DiffLine[] {
  const oldLines = original.split("\n");
  const newLines = generated.split("\n");

  const m = oldLines.length;
  const n = newLines.length;
  const max = m + n;
  const v = new Map<number, number>();
  const trace: Map<number, number>[] = [];

  v.set(1, 0);
  outer:
  for (let d = 0; d <= max; d++) {
    trace.push(new Map(v));
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v.get(k - 1) ?? 0) < (v.get(k + 1) ?? 0))) {
        x = v.get(k + 1) ?? 0;
      } else {
        x = (v.get(k - 1) ?? 0) + 1;
      }
      let y = x - k;
      while (x < m && y < n && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }
      v.set(k, x);
      if (x >= m && y >= n) break outer;
    }
  }

  const edits: Array<{ type: "same" | "add" | "remove"; oldIdx: number; newIdx: number }> = [];
  let x = m;
  let y = n;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && (vd.get(k - 1) ?? 0) < (vd.get(k + 1) ?? 0))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vd.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
      edits.unshift({ type: "same", oldIdx: x, newIdx: y });
    }
    if (d > 0) {
      if (x === prevX) {
        y--;
        edits.unshift({ type: "add", oldIdx: -1, newIdx: y });
      } else {
        x--;
        edits.unshift({ type: "remove", oldIdx: x, newIdx: -1 });
      }
    }
  }

  let oldNum = 0;
  let newNum = 0;
  return edits.map((e) => {
    if (e.type === "same") {
      oldNum++;
      newNum++;
      return { type: "same", content: oldLines[e.oldIdx], oldNum, newNum };
    } else if (e.type === "remove") {
      oldNum++;
      return { type: "remove", content: oldLines[e.oldIdx], oldNum, newNum: null };
    } else {
      newNum++;
      return { type: "add", content: newLines[e.newIdx], oldNum: null, newNum };
    }
  });
}

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

  const diffLines = useMemo(() => {
    if (isModification && script.original_content) {
      return computeUnifiedDiff(script.original_content, script.generated_content);
    }
    return null;
  }, [isModification, script.original_content, script.generated_content]);

  const diffStats = useMemo(() => {
    if (!diffLines) return null;
    const added = diffLines.filter((l) => l.type === "add").length;
    const removed = diffLines.filter((l) => l.type === "remove").length;
    return { added, removed };
  }, [diffLines]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div
        className="absolute inset-4 flex flex-col bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
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
            {diffStats && (
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                <span className="text-green-600 dark:text-green-400">+{diffStats.added}</span>
                {" "}
                <span className="text-red-600 dark:text-red-400">-{diffStats.removed}</span>
              </span>
            )}
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
        {diffLines ? (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full border-collapse text-xs font-mono">
              <tbody>
                {diffLines.map((line, i) => {
                  const bg =
                    line.type === "add"
                      ? "bg-green-50 dark:bg-green-950/50"
                      : line.type === "remove"
                        ? "bg-red-50 dark:bg-red-950/50"
                        : "";
                  const textColor =
                    line.type === "add"
                      ? "text-green-800 dark:text-green-300"
                      : line.type === "remove"
                        ? "text-red-800 dark:text-red-300"
                        : "text-zinc-700 dark:text-zinc-300";
                  const marker =
                    line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
                  const markerColor =
                    line.type === "add"
                      ? "text-green-600 dark:text-green-400"
                      : line.type === "remove"
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-400 dark:text-zinc-600";

                  return (
                    <tr key={i} className={bg}>
                      <td className="w-12 text-right pr-1 py-0 text-zinc-400 dark:text-zinc-600 select-none border-r border-zinc-200 dark:border-zinc-800">
                        {line.oldNum ?? ""}
                      </td>
                      <td className="w-12 text-right pr-1 py-0 text-zinc-400 dark:text-zinc-600 select-none border-r border-zinc-200 dark:border-zinc-800">
                        {line.newNum ?? ""}
                      </td>
                      <td className={`w-5 text-center py-0 select-none ${markerColor}`}>
                        {marker}
                      </td>
                      <td className={`py-0 pl-1 whitespace-pre ${textColor}`}>
                        {line.content}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full border-collapse text-xs font-mono">
              <tbody>
                {script.generated_content.split("\n").map((line, i) => (
                  <tr key={i} className="bg-green-50 dark:bg-green-950/50">
                    <td className="w-12 text-right pr-1 py-0 text-zinc-400 dark:text-zinc-600 select-none border-r border-zinc-200 dark:border-zinc-800">
                      {i + 1}
                    </td>
                    <td className="w-5 text-center py-0 select-none text-green-600 dark:text-green-400">
                      +
                    </td>
                    <td className="py-0 pl-1 whitespace-pre text-green-800 dark:text-green-300">
                      {line}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
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
