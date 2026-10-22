// ABOUTME: Dashboard page — landing page showing all projects with a create button.
// ABOUTME: Entry point for the application; lists projects and links to creation flow.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listProjects, deleteProject } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import type { Project } from "@/types";

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  valid: { text: "Ready", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  cloned: { text: "Cloned", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  cloning: { text: "Cloning...", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  pending: { text: "Pending", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  error: { text: "Error", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchProjects() {
    try {
      const data = await listProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  }

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">AI Test Optimization Agent</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage your test optimization projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/settings"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            title="Settings"
          >
            <svg
              className="w-5 h-5 text-zinc-500 dark:text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7 7 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a7 7 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.282c-.062-.373-.312-.686-.644-.87a7 7 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7 7 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </Link>
          <Link
            href="/projects/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Create Project
          </Link>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mb-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Analyse your existing test suites against BDD acceptance criteria using AI. The agent identifies which tests already cover your requirements, which need modifications, and what new tests are missing. Generate and accept test scripts directly into your repo with full git tracking.
          </p>
        </div>

        {loading && (
          <div className="text-sm text-zinc-500 text-center py-12">
            Loading projects...
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300 mb-4">
            {error}
          </div>
        )}

        {!loading && projects.length === 0 && !error && (
          <div className="text-center py-16">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              No projects yet. Create your first project to get started.
            </p>
            <Link
              href="/projects/new"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Create Project
            </Link>
          </div>
        )}

        {projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const status = STATUS_LABELS[project.repo_status] ?? STATUS_LABELS.pending;
              return (
                <div
                  key={project.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-base font-semibold hover:text-blue-600 transition-colors"
                    >
                      {project.name}
                    </Link>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.text}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="text-xs text-zinc-400 dark:text-zinc-500 space-y-1">
                    <p>
                      <span className="font-medium">
                        {project.repo_type === "local" ? "Local" : "GitHub"}:
                      </span>{" "}
                      <span className="break-all">{project.repo_url}</span>
                    </p>
                    <p>
                      Created{" "}
                      {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {project.repo_error && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {project.repo_error}
                    </p>
                  )}

                  <div className="mt-auto pt-2 flex gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex-1 text-center rounded border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => handleDelete(project.id, project.name)}
                      className="rounded border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
