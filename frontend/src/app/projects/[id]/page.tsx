// ABOUTME: Project detail page — edit metadata, view test stats, delete project.
// ABOUTME: Repo path is read-only; name and description are editable.

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getProject,
  updateProject,
  deleteProject,
  getTestStats,
  getRepoDirs,
  createAC,
  listACs,
  deleteAC,
} from "@/lib/api";
import type { Project, TestStats, TestDirectory, TestFile, RepoDir, ACRead } from "@/types";


function DirectoryNode({ dir }: { dir: TestDirectory }) {
  const [open, setOpen] = useState(true);
  const fileCount = dir.files.length;
  const testCount = dir.files.reduce((sum, f) => sum + f.tests.length, 0);

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <span className="text-zinc-400 select-none w-4 text-center">
          {open ? "▼" : "▶"}
        </span>
        <span className="font-mono font-semibold">{dir.directory}</span>
        <span className="ml-auto text-zinc-400">
          {fileCount} {fileCount === 1 ? "file" : "files"}, {testCount}{" "}
          {testCount === 1 ? "test" : "tests"}
        </span>
      </button>
      {open && (
        <div className="ml-4">
          {dir.files.map((file) => (
            <FileNode key={file.path} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}


function FileNode({ file }: { file: TestFile }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <span className="text-zinc-400 select-none w-4 text-center">
          {file.tests.length > 0 ? (open ? "▼" : "▶") : "•"}
        </span>
        <span className="font-mono text-zinc-700 dark:text-zinc-300">
          {file.name}
        </span>
        <span className="ml-auto text-zinc-400">
          {file.tests.length} {file.tests.length === 1 ? "test" : "tests"}
        </span>
      </button>
      {open && file.tests.length > 0 && (
        <ul className="ml-10 pb-1.5">
          {file.tests.map((testName, i) => (
            <li
              key={i}
              className="py-0.5 text-xs font-mono text-zinc-500 dark:text-zinc-400"
            >
              {testName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RepoDirBrowserNode({
  dir,
  projectId,
  onSelect,
}: {
  dir: RepoDir;
  projectId: string;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<RepoDir[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    if (!dir.has_children) return;
    if (!open && children === null) {
      setLoading(true);
      try {
        const dirs = await getRepoDirs(projectId, dir.path);
        setChildren(dirs);
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
        <span className="font-mono truncate">{dir.name}/</span>
        <button
          onClick={() => onSelect(dir.path)}
          className="ml-auto shrink-0 text-blue-600 dark:text-blue-400 hover:underline text-xs"
        >
          Select
        </button>
      </div>
      {open && children && children.length > 0 && (
        <div className="ml-4">
          {children.map((child) => (
            <RepoDirBrowserNode
              key={child.path}
              dir={child}
              projectId={projectId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function RepoDirBrowser({
  projectId,
  onSelect,
}: {
  projectId: string;
  onSelect: (path: string) => void;
}) {
  const [roots, setRoots] = useState<RepoDir[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRepoDirs(projectId)
      .then(setRoots)
      .catch(() => setRoots([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return <p className="text-xs text-zinc-400 py-2">Loading directories...</p>;
  }

  if (!roots || roots.length === 0) {
    return <p className="text-xs text-zinc-400 py-2">No directories found.</p>;
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 max-h-64 overflow-y-auto">
      {roots.map((dir) => (
        <RepoDirBrowserNode
          key={dir.path}
          dir={dir}
          projectId={projectId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}


export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Test stats
  const [stats, setStats] = useState<TestStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Acceptance criteria
  const [acs, setAcs] = useState<ACRead[]>([]);
  const [acInput, setAcInput] = useState("");
  const [acSaving, setAcSaving] = useState(false);
  const [acError, setAcError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const [data, acList] = await Promise.all([
          getProject(projectId),
          listACs(projectId),
        ]);
        setProject(data);
        setName(data.name);
        setDescription(data.description ?? "");
        setAcs(acList);
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

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await getTestStats(projectId);
      setStats(data);
    } catch (err) {
      setStatsError(
        err instanceof Error ? err.message : "Failed to load test stats"
      );
    } finally {
      setStatsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (
      project &&
      (project.repo_status === "valid" || project.repo_status === "cloned")
    ) {
      fetchStats();
    }
  }, [project, fetchStats]);

  const isDirty =
    project !== null &&
    (name.trim() !== project.name ||
      (description.trim() || "") !== (project.description ?? ""));

  async function handleSave() {
    if (!isDirty) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const updated = await updateProject(projectId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setProject(updated);
      setSaveMessage("Saved");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : "Failed to save"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetTestPath(path: string) {
    try {
      const updated = await updateProject(projectId, { test_path: path });
      setProject(updated);
      setStats(null);
      fetchStats();
    } catch (err) {
      setStatsError(
        err instanceof Error ? err.message : "Failed to set test path"
      );
    }
  }

  async function handleClearTestPath() {
    try {
      const updated = await updateProject(projectId, { test_path: null });
      setProject(updated);
      setStats(null);
      fetchStats();
    } catch (err) {
      setStatsError(
        err instanceof Error ? err.message : "Failed to clear test path"
      );
    }
  }

  async function handleSaveAC() {
    if (!acInput.trim()) return;
    setAcSaving(true);
    setAcError(null);
    try {
      const ac = await createAC(projectId, { content: acInput.trim() });
      setAcs((prev) => [ac, ...prev]);
      setAcInput("");
    } catch (err) {
      setAcError(
        err instanceof Error ? err.message : "Failed to save acceptance criteria"
      );
    } finally {
      setAcSaving(false);
    }
  }

  async function handleDeleteAC(acId: string) {
    try {
      await deleteAC(projectId, acId);
      setAcs((prev) => prev.filter((a) => a.id !== acId));
    } catch (err) {
      setAcError(
        err instanceof Error ? err.message : "Failed to delete"
      );
    }
  }

  async function handleDelete() {
    if (!project) return;
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`))
      return;
    try {
      await deleteProject(projectId);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete project"
      );
    }
  }

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
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-start justify-between gap-4">
        <div>
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
        </div>
        <button
          onClick={handleDelete}
          className="shrink-0 rounded-lg border border-red-200 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          Delete Project
        </button>
      </header>

      <div className="flex-1 p-6 space-y-6 max-w-4xl">
        {/* Editable Fields */}
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold">Project Details</h2>

          <div>
            <label
              htmlFor="project-name"
              className="block text-sm font-medium mb-1.5"
            >
              Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="project-description"
              className="block text-sm font-medium mb-1.5"
            >
              Description
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            {saveMessage && (
              <span
                className={`text-sm ${
                  saveMessage === "Saved"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {saveMessage}
              </span>
            )}
          </div>
        </section>

        {/* Repository (read-only) */}
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

          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
            Repository path cannot be changed. To use a different repo, create a
            new project.
          </p>
        </section>

        {/* Test Suite — Stats + Explorer Tree */}
        {isRepoReady && (
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Test Suite</h2>
              <button
                onClick={fetchStats}
                disabled={statsLoading}
                className="text-xs px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {statsLoading ? "Scanning..." : "Refresh"}
              </button>
            </div>

            {project.test_path && (
              <div className="flex items-center gap-2 mb-4 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Test path:
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-2 py-0.5 font-mono text-blue-700 dark:text-blue-300">
                  {project.test_path}
                  <button
                    onClick={handleClearTestPath}
                    className="ml-1 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                    title="Clear test path (revert to auto-detection)"
                  >
                    x
                  </button>
                </span>
              </div>
            )}

            {statsError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                {statsError}
              </p>
            )}

            {stats && stats.total_files === 0 && !project.test_path && (
              <div className="space-y-3 mb-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No tests detected automatically. Select the directory
                  containing your test files:
                </p>
                <RepoDirBrowser
                  projectId={projectId}
                  onSelect={handleSetTestPath}
                />
              </div>
            )}

            {stats && (
              <div className="space-y-5">
                {/* Summary cards */}
                <div className="flex gap-4">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 px-4 py-3 text-center min-w-24">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {stats.total_files}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Test Files
                    </p>
                  </div>
                  <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 px-4 py-3 text-center min-w-24">
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {stats.total_tests}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Test Cases
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 px-4 py-3 text-center min-w-24">
                    <p className="text-2xl font-bold">
                      {stats.frameworks.length}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Frameworks
                    </p>
                  </div>
                </div>

                {stats.frameworks.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      Detected Frameworks
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {stats.frameworks.map((fw) => (
                        <span
                          key={fw}
                          className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium"
                        >
                          {fw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Test Explorer Tree */}
                {stats.test_tree?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                      Test Explorer
                    </p>
                    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                      {stats.test_tree.map((dir) => (
                        <DirectoryNode key={dir.directory} dir={dir} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!stats && !statsError && !statsLoading && (
              <p className="text-sm text-zinc-400">No stats available.</p>
            )}
          </section>
        )}

        {/* Acceptance Criteria */}
        {isRepoReady && (
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h2 className="text-sm font-semibold mb-4">Acceptance Criteria</h2>

            <div className="space-y-3 mb-4">
              <textarea
                value={acInput}
                onChange={(e) => setAcInput(e.target.value)}
                placeholder={"Given a user is on the login page\nWhen they enter valid credentials\nThen they should be redirected to the dashboard"}
                rows={5}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveAC}
                  disabled={acSaving || !acInput.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {acSaving ? "Saving..." : "Save Criteria"}
                </button>
                {acError && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {acError}
                  </span>
                )}
              </div>
            </div>

            {acs.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Saved Criteria ({acs.length})
                </p>
                {acs.map((ac) => (
                  <div
                    key={ac.id}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <pre className="flex-1 text-xs font-mono whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                        {ac.content}
                      </pre>
                      <div className="flex gap-2 shrink-0">
                        <button
                          disabled
                          title="Coming next — AI analysis"
                          className="rounded border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400 cursor-not-allowed"
                        >
                          Analyze
                        </button>
                        <button
                          onClick={() => handleDeleteAC(ac.id)}
                          className="rounded border border-red-200 dark:border-red-800 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                      {new Date(ac.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Run Tests (stub) */}
        {isRepoReady && (
          <section className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Run Tests</h2>
              <button
                disabled
                title="Coming soon"
                className="rounded-lg bg-zinc-200 dark:bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
              >
                Run Tests
              </button>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Test execution from the tool is coming soon. The test runner will
              execute the CLI command for the detected framework directly from
              the repo location.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
