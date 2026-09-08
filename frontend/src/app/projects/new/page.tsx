// ABOUTME: Create Project page — form for creating a new project with a mandatory repo.
// ABOUTME: User provides name, optional description, and either a local path or GitHub URL.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProject, listSystemDirs } from "@/lib/api";
import type { ProjectCreate, SystemDir } from "@/types";


function FolderBrowserNode({
  dir,
  onSelect,
}: {
  dir: SystemDir;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<SystemDir[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    if (!dir.has_children) return;
    if (!open && children === null) {
      setLoading(true);
      try {
        const result = await listSystemDirs(dir.path);
        setChildren(result.dirs);
      } catch {
        setChildren([]);
      } finally {
        setLoading(false);
      }
    }
    setOpen(!open);
  }

  return (
    <div>
      <div className="flex items-center gap-1 py-1 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded text-xs">
        <button
          type="button"
          onClick={handleToggle}
          className="text-zinc-400 select-none w-4 text-center shrink-0"
        >
          {dir.has_children
            ? loading
              ? "..."
              : open
                ? "▼"
                : "▶"
            : ""}
        </button>
        <span className="font-mono truncate">{dir.name}</span>
        <button
          type="button"
          onClick={() => onSelect(dir.path)}
          className="ml-auto shrink-0 text-blue-600 dark:text-blue-400 hover:underline text-xs"
        >
          Select
        </button>
      </div>
      {open && children && children.length > 0 && (
        <div className="ml-4">
          {children.map((child) => (
            <FolderBrowserNode
              key={child.path}
              dir={child}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function FolderBrowser({
  onSelect,
  onClose,
}: {
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [roots, setRoots] = useState<SystemDir[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSystemDirs()
      .then((result) => setRoots(result.dirs))
      .catch(() => setRoots([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-xs font-medium">Select Repository Folder</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Close
        </button>
      </div>
      <div className="p-2 max-h-72 overflow-y-auto">
        {loading && (
          <p className="text-xs text-zinc-400 py-2">Loading...</p>
        )}
        {roots && roots.length === 0 && (
          <p className="text-xs text-zinc-400 py-2">No directories found.</p>
        )}
        {roots &&
          roots.map((dir) => (
            <FolderBrowserNode
              key={dir.path}
              dir={dir}
              onSelect={(path) => {
                onSelect(path);
                onClose();
              }}
            />
          ))}
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload: ProjectCreate = {
      name: name.trim(),
      description: description.trim() || undefined,
      repo_type: repoType,
      repo_url: repoUrl.trim(),
    };

    try {
      await createProject(payload);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create project"
      );
    } finally {
      setIsSubmitting(false);
    }
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
                  setShowBrowser(false);
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
                  setShowBrowser(false);
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
                    onClick={() => setShowBrowser(!showBrowser)}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      showBrowser
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
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

            {showBrowser && repoType === "local" && (
              <div className="mt-3">
                <FolderBrowser
                  onSelect={(path) => setRepoUrl(path)}
                  onClose={() => setShowBrowser(false)}
                />
              </div>
            )}
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
    </main>
  );
}
