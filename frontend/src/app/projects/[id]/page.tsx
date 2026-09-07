// ABOUTME: Project detail page — shows project info and will host the optimization workflow.
// ABOUTME: Placeholder for Chunk 2; currently displays project metadata and repo status.

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/api";
import type { Project } from "@/types";

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const data = await getProject(projectId);
        setProject(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load project"
        );
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [projectId]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Loading project...</p>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="flex-1 p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          {error ?? "Project not found"}
        </div>
        <Link
          href="/"
          className="inline-block mt-4 text-sm text-blue-600 hover:underline"
        >
          Back to Dashboard
        </Link>
      </main>
    );
  }

  const isRepoReady =
    project.repo_status === "valid" || project.repo_status === "cloned";

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
          <span>{project.name}</span>
        </div>
        <h1 className="text-xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {project.description}
          </p>
        )}
      </header>

      <div className="flex-1 p-6 space-y-6">
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold mb-3">Repository</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500 dark:text-zinc-400">Type</dt>
            <dd>{project.repo_type === "local" ? "Local Path" : "GitHub"}</dd>

            <dt className="text-zinc-500 dark:text-zinc-400">Source</dt>
            <dd className="font-mono text-xs break-all">{project.repo_url}</dd>

            {project.local_path && (
              <>
                <dt className="text-zinc-500 dark:text-zinc-400">
                  Local Path
                </dt>
                <dd className="font-mono text-xs break-all">
                  {project.local_path}
                </dd>
              </>
            )}

            <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isRepoReady
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : project.repo_status === "error"
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                }`}
              >
                {project.repo_status}
              </span>
            </dd>
          </dl>

          {project.repo_error && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">
              {project.repo_error}
            </p>
          )}
        </section>

        {isRepoReady && (
          <section className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Repository is ready. BDD input and test generation will be
              available in the next development chunk.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
