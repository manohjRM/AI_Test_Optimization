// ABOUTME: Create Project page — form for creating a new project with a mandatory repo.
// ABOUTME: User provides name, optional description, and either a local path or GitHub URL.

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProject, listSystemDirs } from "@/lib/api";
import type { ProjectCreate, SystemDir } from "@/types";


function FolderPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [dirs, setDirs] = useState<SystemDir[]>([]);
  const [loading, setLoading] = useState(true);
  const [pathInput, setPathInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const navigate = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSystemDirs(path);
      setDirs(result.dirs);
      setCurrentPath(result.current_path);
      setParentPath(result.parent_path);
      setPathInput(result.current_path);
    } catch {
      setError("Failed to load directory");
      setDirs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    navigate("");
  }, [navigate]);

  function handlePathSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pathInput.trim()) {
      navigate(pathInput.trim());
    }
  }

  const breadcrumbs = currentPath
    ? currentPath.split(/[/\\]/).filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold">Select Repository Folder</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none"
          >
            x
          </button>
        </div>

        {/* Path bar */}
        <form
          onSubmit={handlePathSubmit}
          className="flex gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
        >
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="Type a path and press Enter..."
            className="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="shrink-0 rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Go
          </button>
        </form>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 px-4 py-2 text-xs overflow-x-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => navigate("")}
            className="shrink-0 text-blue-600 dark:text-blue-400 hover:underline"
          >
            Root
          </button>
          {breadcrumbs.map((segment, i) => {
            const pathUpTo = breadcrumbs
              .slice(0, i + 1)
              .join("\\");
            const fullPath =
              currentPath.includes(":\\")
                ? pathUpTo.length <= 2
                  ? pathUpTo + "\\"
                  : pathUpTo
                : "/" + pathUpTo;
            return (
              <span key={i} className="flex items-center gap-1">
                <span className="text-zinc-400">/</span>
                <button
                  type="button"
                  onClick={() => navigate(fullPath)}
                  className="shrink-0 text-blue-600 dark:text-blue-400 hover:underline truncate max-w-32"
                >
                  {segment}
                </button>
              </span>
            );
          })}
        </div>

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 min-h-48">
          {loading && (
            <p className="text-xs text-zinc-400 text-center py-8">
              Loading...
            </p>
          )}

          {error && (
            <p className="text-xs text-red-500 text-center py-4">{error}</p>
          )}

          {!loading && !error && (
            <>
              {parentPath !== null && (
                <button
                  type="button"
                  onClick={() => navigate(parentPath)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  <span className="text-zinc-400">..</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Up one level
                  </span>
                </button>
              )}
              {dirs.length === 0 && (
                <p className="text-xs text-zinc-400 text-center py-4">
                  No subdirectories
                </p>
              )}
              {dirs.map((dir) => (
                <button
                  key={dir.path}
                  type="button"
                  onClick={() => navigate(dir.path)}
                  onDoubleClick={() => {
                    onSelect(dir.path);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors group"
                >
                  <span className="text-zinc-400 shrink-0">
                    {dir.has_children ? "▶" : ""}
                  </span>
                  <span className="font-mono truncate text-left">
                    {dir.name}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
          <p className="text-xs text-zinc-400 truncate font-mono">
            {currentPath || "Select a folder"}
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-zinc-300 dark:border-zinc-600 px-4 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!currentPath}
              onClick={() => {
                onSelect(currentPath);
                onClose();
              }}
              className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Select This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function NewProject() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repoType, setRepoType] = useState<"local" | "github">("local");
  const [repoUrl, setRepoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);

  async function submitProject(forceGit: boolean) {
    setError(null);
    setIsSubmitting(true);

    const payload: ProjectCreate = {
      name: name.trim(),
      description: description.trim() || undefined,
      repo_type: repoType,
      repo_url: repoUrl.trim(),
      force_init_git: forceGit,
    };

    try {
      await createProject(payload);
      router.push("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create project";

      if (message.includes("409") && message.includes("NO_GIT:")) {
        const accepted = confirm(
          "No git repository detected at this path.\n\n" +
            "Would you like to initialize a git repository (git init) and continue?"
        );
        if (accepted) {
          await submitProject(true);
          return;
        }
      }

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitProject(false);
  }

  const isFormValid = name.trim().length > 0 && repoUrl.trim().length > 0;

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span>New Project</span>
        </div>
        <h1 className="text-xl font-bold">Create Project</h1>
      </header>

      <div className="flex-1 p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1.5">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Payment Service Tests"
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium mb-1.5"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project..."
              rows={3}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">
              Repository Source <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setRepoType("local");
                  setRepoUrl("");
                }}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  repoType === "local"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-600"
                    : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                Local Path
              </button>
              <button
                type="button"
                onClick={() => {
                  setRepoType("github");
                  setRepoUrl("");
                }}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  repoType === "github"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-600"
                    : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                GitHub URL
              </button>
            </div>

            <div>
              <label
                htmlFor="repo-url"
                className="block text-sm font-medium mb-1.5"
              >
                {repoType === "local"
                  ? "Local Repository Path"
                  : "GitHub Repository URL"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="repo-url"
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder={
                    repoType === "local"
                      ? "C:\\Projects\\my-app  or  /home/user/my-app"
                      : "https://github.com/owner/repo.git"
                  }
                  required
                  className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {repoType === "local" && (
                  <button
                    type="button"
                    onClick={() => setShowBrowser(true)}
                    className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Browse
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                {repoType === "local"
                  ? "The directory must contain a .git folder (be a git repository)."
                  : "The repo will be cloned to the server. Use HTTPS URL for public repos."}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Creating..." : "Create Project"}
            </button>
            <Link
              href="/"
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {showBrowser && (
        <FolderPickerModal
          onSelect={(path) => setRepoUrl(path)}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </main>
  );
}
