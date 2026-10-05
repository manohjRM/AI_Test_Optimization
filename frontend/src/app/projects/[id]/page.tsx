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
  updateAC,
  analyzeTests,
  generateSummary,
  generateModify,
  generateNew,
  listGeneratedScripts,
  acceptScript,
  rejectScript,
} from "@/lib/api";
import CodeViewerModal from "@/components/CodeViewerModal";
import type { Project, TestStats, TestDirectory, TestFile, RepoDir, ACRead, AnalysisResult, GeneratedScript } from "@/types";


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
  const [editingAcId, setEditingAcId] = useState<string | null>(null);
  const [editingAcContent, setEditingAcContent] = useState("");

  // Summary
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryTab, setSummaryTab] = useState<"business" | "functional">("business");
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Analysis
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analyzingAcId, setAnalyzingAcId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [resultsPanel, setResultsPanel] = useState<"covered" | "partial" | "missing" | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analyzeAllProgress, setAnalyzeAllProgress] = useState({ done: 0, total: 0 });

  // Generation
  const [activeAcId, setActiveAcId] = useState<string | null>(null);
  const [generatedScripts, setGeneratedScripts] = useState<GeneratedScript[]>([]);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [viewingScript, setViewingScript] = useState<GeneratedScript | null>(null);
  const [acceptingScript, setAcceptingScript] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generateAllProgress, setGenerateAllProgress] = useState({ done: 0, total: 0 });
  const [generateAllDone, setGenerateAllDone] = useState(false);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [acceptAllProgress, setAcceptAllProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    async function fetch() {
      try {
        const [data, acList, scripts] = await Promise.all([
          getProject(projectId),
          listACs(projectId),
          listGeneratedScripts(projectId),
        ]);
        setProject(data);
        setName(data.name);
        setDescription(data.description ?? "");
        setAcs(acList);
        setGeneratedScripts(scripts);
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

  async function handleAnalyze(acId: string) {
    setAnalyzingAcId(acId);
    setActiveAcId(acId);
    setAnalysisResult(null);
    setAnalysisError(null);
    setResultsPanel(null);
    setGenerateAllDone(false);
    try {
      const result = await analyzeTests(projectId, acId);
      setAnalysisResult(result);
      const [refreshedProject, refreshedAcs] = await Promise.all([
        getProject(projectId),
        listACs(projectId),
      ]);
      setProject(refreshedProject);
      setAcs(refreshedAcs);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Analysis failed"
      );
    } finally {
      setAnalyzingAcId(null);
    }
  }

  async function handleAnalyzeAll() {
    if (acs.length === 0) return;
    setAnalyzingAll(true);
    setAnalysisResult(null);
    setAnalysisError(null);
    setResultsPanel(null);
    setGeneratedScripts([]);
    setGenerateAllDone(false);
    setAnalyzeAllProgress({ done: 0, total: acs.length });
    let lastResult: AnalysisResult | null = null;
    let lastAcId: string | null = null;
    try {
      for (let i = 0; i < acs.length; i++) {
        setAnalyzingAcId(acs[i].id);
        const result = await analyzeTests(projectId, acs[i].id);
        lastResult = result;
        lastAcId = acs[i].id;
        setAnalyzeAllProgress({ done: i + 1, total: acs.length });
      }
      const [refreshedAcs, refreshedProject, scripts] = await Promise.all([
        listACs(projectId),
        getProject(projectId),
        listGeneratedScripts(projectId),
      ]);
      setAcs(refreshedAcs);
      setProject(refreshedProject);
      setGeneratedScripts(scripts);
      if (lastResult && lastAcId) {
        setAnalysisResult(lastResult);
        setActiveAcId(lastAcId);
      }
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Analyze all failed"
      );
    } finally {
      setAnalyzingAcId(null);
      setAnalyzingAll(false);
    }
  }

  async function handleGenerateSummary() {
    setSummaryGenerating(true);
    setSummaryError(null);
    try {
      const updated = await generateSummary(projectId);
      setProject(updated);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : "Failed to generate summary"
      );
    } finally {
      setSummaryGenerating(false);
    }
  }

  async function handleGenerateModify(acId: string, match: { file_path: string; test_name: string; modifications_needed: string[] }) {
    const key = `modify:${match.file_path}:${match.test_name}`;
    setGeneratingKey(key);
    setGenerationError(null);
    try {
      const script = await generateModify(projectId, {
        ac_id: acId,
        file_path: match.file_path,
        test_name: match.test_name,
        modifications_needed: match.modifications_needed,
      });
      setGeneratedScripts((prev) => [script, ...prev]);
      setViewingScript(script);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingKey(null);
    }
  }

  async function handleGenerateNew(acId: string, scenario: { scenario_name: string; type: string; description: string; steps: string[]; priority: string; suggested_file: string }) {
    const key = `new:${scenario.scenario_name}`;
    setGeneratingKey(key);
    setGenerationError(null);
    try {
      const script = await generateNew(projectId, {
        ac_id: acId,
        scenario_name: scenario.scenario_name,
        scenario_type: scenario.type,
        description: scenario.description,
        steps: scenario.steps,
        priority: scenario.priority,
        suggested_file: scenario.suggested_file,
      });
      setGeneratedScripts((prev) => [script, ...prev]);
      setViewingScript(script);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingKey(null);
    }
  }

  async function handleAcceptScript(scriptId: string) {
    setAcceptingScript(true);
    try {
      await acceptScript(projectId, scriptId);
      setGeneratedScripts((prev) =>
        prev.map((s) => (s.id === scriptId ? { ...s, status: "applied" as const } : s))
      );
      if (viewingScript?.id === scriptId) {
        setViewingScript((prev) => prev ? { ...prev, status: "applied" as const } : null);
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setAcceptingScript(false);
    }
  }

  async function handleAcceptAll() {
    const pending = generatedScripts.filter((s) => s.status === "pending");
    if (pending.length === 0) return;
    setAcceptingAll(true);
    setAcceptAllProgress({ done: 0, total: pending.length });
    try {
      for (let i = 0; i < pending.length; i++) {
        await acceptScript(projectId, pending[i].id);
        setGeneratedScripts((prev) =>
          prev.map((s) => (s.id === pending[i].id ? { ...s, status: "applied" as const } : s))
        );
        setAcceptAllProgress({ done: i + 1, total: pending.length });
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Accept all failed");
    } finally {
      setAcceptingAll(false);
    }
  }

  async function handleRejectScript(scriptId: string) {
    try {
      await rejectScript(projectId, scriptId);
      setGeneratedScripts((prev) =>
        prev.map((s) => (s.id === scriptId ? { ...s, status: "rejected" as const } : s))
      );
      if (viewingScript?.id === scriptId) {
        setViewingScript((prev) => prev ? { ...prev, status: "rejected" as const } : null);
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Reject failed");
    }
  }

  async function handleGenerateAll() {
    if (!analysisResult || !activeAcId) return;
    const changesNeeded = analysisResult.matches.filter((m) => m.relevance === "required changes");
    const missing = analysisResult.missing_scenarios;
    const total = changesNeeded.length + missing.length;
    if (total === 0) return;

    setGeneratingAll(true);
    setGenerationError(null);
    setGenerateAllProgress({ done: 0, total });

    let done = 0;
    try {
      for (const match of changesNeeded) {
        if (!findScript(match.file_path, match.test_name)) {
          const script = await generateModify(projectId, {
            ac_id: activeAcId,
            file_path: match.file_path,
            test_name: match.test_name,
            modifications_needed: match.modifications_needed,
          });
          setGeneratedScripts((prev) => [script, ...prev]);
        }
        done++;
        setGenerateAllProgress({ done, total });
      }

      for (const scenario of missing) {
        if (!findScript(scenario.suggested_file, scenario.scenario_name)) {
          const script = await generateNew(projectId, {
            ac_id: activeAcId,
            scenario_name: scenario.scenario_name,
            scenario_type: scenario.type,
            description: scenario.description,
            steps: scenario.steps,
            priority: scenario.priority,
            suggested_file: scenario.suggested_file,
          });
          setGeneratedScripts((prev) => [script, ...prev]);
        }
        done++;
        setGenerateAllProgress({ done, total });
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Generate all failed");
    } finally {
      setGeneratingAll(false);
      setGenerateAllDone(true);
    }
  }

  function findScript(filePath: string, testNameOrScenario: string): GeneratedScript | undefined {
    return generatedScripts.find(
      (s) => s.file_path === filePath && (
        (s.source_item as Record<string, unknown>).test_name === testNameOrScenario ||
        (s.source_item as Record<string, unknown>).scenario_name === testNameOrScenario
      )
    );
  }

  function handleStartEditAC(ac: ACRead) {
    setEditingAcId(ac.id);
    setEditingAcContent(ac.content);
    setAcError(null);
  }

  function handleCancelEditAC() {
    setEditingAcId(null);
    setEditingAcContent("");
  }

  async function handleSaveEditAC() {
    if (!editingAcId || !editingAcContent.trim()) return;
    setAcSaving(true);
    setAcError(null);
    try {
      const updated = await updateAC(projectId, editingAcId, { content: editingAcContent.trim() });
      setAcs((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setEditingAcId(null);
      setEditingAcContent("");
    } catch (err) {
      setAcError(
        err instanceof Error ? err.message : "Failed to update acceptance criteria"
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

  function handleViewAnalysis(ac: ACRead) {
    if (ac.analysis_result) {
      setActiveAcId(ac.id);
      setAnalysisResult(ac.analysis_result);
      setResultsPanel(null);
      setAnalysisError(null);
    }
  }

  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const REPORT_CSS = `
  :root { --green: #16a34a; --yellow: #ca8a04; --red: #dc2626; --orange: #ea580c; --zinc: #71717a; --bg: #ffffff; --fg: #18181b; --muted: #52525b; --border: #e4e4e7; --card: #fafafa; }
  @media (prefers-color-scheme: dark) { :root { --bg: #18181b; --fg: #fafaf9; --muted: #a1a1aa; --border: #3f3f46; --card: #27272a; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.6; width: 100%; padding: 32px 48px; }
  h1 { font-size: 1.75rem; margin-bottom: 4px; }
  .date { color: var(--muted); font-size: 0.85rem; margin-bottom: 32px; }
  h2 { font-size: 1.2rem; margin: 36px 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--border); }
  h3 { font-size: 1.05rem; margin: 28px 0 10px; color: var(--fg); }
  .summary-text { color: var(--muted); margin-bottom: 16px; font-size: 0.95rem; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
  .stat { padding: 20px; border-radius: 10px; text-align: center; }
  .stat-num { font-size: 2rem; font-weight: 700; }
  .stat-label { font-size: 0.8rem; font-weight: 500; margin-top: 4px; }
  .stat-green { background: #f0fdf4; border: 1px solid #bbf7d0; color: var(--green); }
  .stat-yellow { background: #fefce8; border: 1px solid #fef08a; color: var(--yellow); }
  .stat-red { background: #fef2f2; border: 1px solid #fecaca; color: var(--red); }
  @media (prefers-color-scheme: dark) { .stat-green { background: #052e16; border-color: #166534; } .stat-yellow { background: #422006; border-color: #854d0e; } .stat-red { background: #450a0a; border-color: #991b1b; } }
  .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .card { border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; background: var(--card); }
  .card-green { border-left: 4px solid var(--green); }
  .card-yellow { border-left: 4px solid var(--yellow); }
  .card-red { border-left: 4px solid var(--red); }
  .card-orange { border-left: 4px solid var(--orange); }
  .card-muted { border-left: 4px solid var(--zinc); }
  .test-name { font-family: 'SF Mono', Consolas, monospace; font-weight: 600; font-size: 0.9rem; word-break: break-word; }
  .file-path { font-family: 'SF Mono', Consolas, monospace; font-size: 0.8rem; color: var(--muted); margin: 4px 0 8px; word-break: break-all; }
  .explanation { font-size: 0.9rem; line-height: 1.5; }
  .mods-label { font-size: 0.85rem; font-weight: 600; color: var(--yellow); margin-top: 12px; }
  .mods-list { margin: 6px 0 0 20px; font-size: 0.85rem; color: var(--yellow); }
  .mods-list li { margin-bottom: 4px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 0.7rem; font-weight: 600; margin-left: 8px; vertical-align: middle; }
  .badge-high { background: #fef2f2; color: var(--red); border: 1px solid #fecaca; }
  .badge-medium { background: #fff7ed; color: var(--orange); border: 1px solid #fed7aa; }
  .badge-low { background: var(--card); color: var(--muted); border: 1px solid var(--border); }
  .badge-type { background: var(--card); color: var(--muted); border: 1px solid var(--border); }
  @media (prefers-color-scheme: dark) { .badge-high { background: #450a0a; border-color: #991b1b; } .badge-medium { background: #431407; border-color: #9a3412; } .badge-low { background: #27272a; border-color: #3f3f46; } .badge-type { background: #27272a; border-color: #3f3f46; } }
  .steps { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; margin: 10px 0; font-family: 'SF Mono', Consolas, monospace; font-size: 0.85rem; line-height: 1.8; }
  .suggested { font-size: 0.8rem; color: var(--muted); font-family: 'SF Mono', Consolas, monospace; margin-top: 6px; }
  .ac-block { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.9rem; white-space: pre-wrap; word-break: break-word; line-height: 1.7; margin-bottom: 20px; }
  .divider { border: none; border-top: 3px solid var(--border); margin: 48px 0; }
  .ac-number { display: inline-flex; align-items: center; justify-content: center; background: var(--fg); color: var(--bg); font-size: 0.75rem; font-weight: 700; width: 24px; height: 24px; border-radius: 99px; margin-right: 10px; vertical-align: middle; }
  .toc { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; }
  .toc-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 0.9rem; color: var(--fg); text-decoration: none; border-bottom: 1px solid var(--border); }
  .toc-item:last-child { border-bottom: none; }
  .toc-item:hover { background: var(--card); }
  .toc-stats { margin-left: auto; display: flex; gap: 12px; font-size: 0.8rem; font-weight: 600; white-space: nowrap; }
  .toc-green { color: var(--green); }
  .toc-yellow { color: var(--yellow); }
  .toc-red { color: var(--red); }
  @media print { body { padding: 20px; } .stats, .card { break-inside: avoid; } .divider { break-before: page; } }`;

  function renderResultSection(result: AnalysisResult) {
    const dm = result.matches.filter((m) => m.relevance === "direct");
    const cn = result.matches.filter((m) => m.relevance === "required changes");

    let h = "";
    h += `<p class="summary-text">${escHtml(result.summary)}</p>\n`;
    h += `<div class="stats">
  <div class="stat stat-green"><div class="stat-num">${dm.length}</div><div class="stat-label">Covered</div></div>
  <div class="stat stat-yellow"><div class="stat-num">${cn.length}</div><div class="stat-label">Partially Covered</div></div>
  <div class="stat stat-red"><div class="stat-num">${result.missing_scenarios.length}</div><div class="stat-label">Not Covered</div></div>
</div>\n`;

    if (dm.length > 0) {
      h += `<h3>Direct Matches</h3>\n<div class="cards-grid">\n`;
      dm.forEach((m) => {
        h += `<div class="card card-green"><div class="test-name">${escHtml(m.test_name)}</div><div class="file-path">${escHtml(m.file_path)}</div><div class="explanation">${escHtml(m.explanation)}</div></div>\n`;
      });
      h += `</div>\n`;
    }

    if (cn.length > 0) {
      h += `<h3>Required Changes</h3>\n<div class="cards-grid">\n`;
      cn.forEach((m) => {
        h += `<div class="card card-yellow"><div class="test-name">${escHtml(m.test_name)}</div><div class="file-path">${escHtml(m.file_path)}</div><div class="explanation">${escHtml(m.explanation)}</div>`;
        if (m.modifications_needed.length > 0) {
          h += `<div class="mods-label">Modifications needed:</div><ul class="mods-list">${m.modifications_needed.map((mod) => `<li>${escHtml(mod)}</li>`).join("")}</ul>`;
        }
        h += `</div>\n`;
      });
      h += `</div>\n`;
    }

    if (result.missing_scenarios.length > 0) {
      h += `<h3>Missing Scenarios</h3>\n<div class="cards-grid">\n`;
      result.missing_scenarios.forEach((s) => {
        const pc = s.priority === "high" ? "card-red" : s.priority === "medium" ? "card-orange" : "card-muted";
        h += `<div class="card ${pc}"><div><span class="test-name">${escHtml(s.scenario_name)}</span><span class="badge badge-${s.priority}">${s.priority}</span><span class="badge badge-type">${escHtml(s.type.replace("_", " "))}</span></div><div class="explanation" style="margin-top:4px">${escHtml(s.description)}</div>`;
        if (s.steps.length > 0) h += `<div class="steps">${s.steps.map((step) => escHtml(step)).join("<br>")}</div>`;
        if (s.suggested_file) h += `<div class="suggested">Suggested file: ${escHtml(s.suggested_file)}</div>`;
        h += `</div>\n`;
      });
      h += `</div>\n`;
    }

    return h;
  }

  function triggerDownload(html: string, filename: string) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadReport(result: AnalysisResult, acContent: string) {
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Test Analysis Report</title><style>${REPORT_CSS}</style></head><body>
<h1>Test Analysis Report</h1>
<p class="date">${escHtml(date)}${project ? ` &mdash; ${escHtml(project.name)}` : ""}</p>
<h2>Acceptance Criteria</h2>
<div class="ac-block">${escHtml(acContent)}</div>
<h2>Analysis</h2>
${renderResultSection(result)}
</body></html>`;
    triggerDownload(html, `analysis-report-${new Date().toISOString().slice(0, 10)}.html`);
  }

  function downloadAllReports() {
    const analyzed = acs.filter((ac) => ac.analysis_result);
    if (analyzed.length === 0) return;

    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const totals = analyzed.reduce(
      (acc, ac) => {
        const r = ac.analysis_result!;
        acc.direct += r.matches.filter((m) => m.relevance === "direct").length;
        acc.changes += r.matches.filter((m) => m.relevance === "required changes").length;
        acc.missing += r.missing_scenarios.length;
        return acc;
      },
      { direct: 0, changes: 0, missing: 0 }
    );

    let toc = `<div class="toc">\n`;
    analyzed.forEach((ac, i) => {
      const r = ac.analysis_result!;
      const dm = r.matches.filter((m) => m.relevance === "direct").length;
      const cn = r.matches.filter((m) => m.relevance === "required changes").length;
      const ms = r.missing_scenarios.length;
      const label = ac.content.split("\n")[0].slice(0, 80);
      toc += `<a class="toc-item" href="#ac-${i + 1}"><span class="ac-number">${i + 1}</span>${escHtml(label)}${ac.content.length > 80 ? "..." : ""}<span class="toc-stats"><span class="toc-green">${dm} covered</span><span class="toc-yellow">${cn} changes</span><span class="toc-red">${ms} missing</span></span></a>\n`;
    });
    toc += `</div>\n`;

    let sections = "";
    analyzed.forEach((ac, i) => {
      if (i > 0) sections += `<hr class="divider">\n`;
      sections += `<h2 id="ac-${i + 1}"><span class="ac-number">${i + 1}</span>Acceptance Criteria ${i + 1}</h2>\n`;
      sections += `<div class="ac-block">${escHtml(ac.content)}</div>\n`;
      sections += renderResultSection(ac.analysis_result!);
    });

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Full Analysis Report</title><style>${REPORT_CSS}</style></head><body>
<h1>Full Analysis Report</h1>
<p class="date">${escHtml(date)}${project ? ` &mdash; ${escHtml(project.name)}` : ""}</p>
<div class="stats">
  <div class="stat stat-green"><div class="stat-num">${totals.direct}</div><div class="stat-label">Total Covered</div></div>
  <div class="stat stat-yellow"><div class="stat-num">${totals.changes}</div><div class="stat-label">Total Changes</div></div>
  <div class="stat stat-red"><div class="stat-num">${totals.missing}</div><div class="stat-label">Total Missing</div></div>
</div>
<p class="summary-text">${analyzed.length} acceptance criteria analyzed</p>
${toc}
${sections}
</body></html>`;
    triggerDownload(html, `full-analysis-report-${new Date().toISOString().slice(0, 10)}.html`);
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

      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Left Column: Project info + Repo + Test Suite */}
        <div className="space-y-6">
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

        {/* Application Summary — compact card */}
        {isRepoReady && (
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Application Summary</h2>
              <div className="flex items-center gap-2">
                {(project.business_summary || project.functional_summary) && !summaryGenerating && (
                  <button
                    onClick={() => setSummaryOpen(true)}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    View Summary
                  </button>
                )}
                <button
                  onClick={handleGenerateSummary}
                  disabled={summaryGenerating}
                  className="rounded-lg border border-blue-300 dark:border-blue-700 px-4 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {summaryGenerating ? "Generating..." : (project.business_summary || project.functional_summary) ? "Regenerate" : "Generate Summary"}
                </button>
              </div>
            </div>

            {summaryError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-3">
                {summaryError}
              </p>
            )}

            {summaryGenerating && (
              <div className="flex items-center gap-3 mt-3">
                <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-500">
                  Generating business and functional summaries from test suite...
                </p>
              </div>
            )}

            {(project.business_summary || project.functional_summary) && !summaryGenerating && (
              <p className="text-xs text-zinc-400 mt-2">
                Summary generated. Click &quot;View Summary&quot; to read the full business and functional analysis.
              </p>
            )}

            {!project.business_summary && !project.functional_summary && !summaryGenerating && !summaryError && (
              <p className="text-xs text-zinc-400 mt-2">
                No summary generated yet. Click &quot;Generate Summary&quot; to analyze the test suite.
              </p>
            )}
          </section>
        )}

        {/* Summary Modal */}
        {summaryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSummaryOpen(false)}>
            <div
              className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-3xl max-h-[80vh] flex flex-col mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
                <h2 className="text-base font-semibold">Application Summary</h2>
                <button
                  onClick={() => setSummaryOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-700 px-6 shrink-0">
                <button
                  onClick={() => setSummaryTab("business")}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                    summaryTab === "business"
                      ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  Business Summary
                </button>
                <button
                  onClick={() => setSummaryTab("functional")}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                    summaryTab === "functional"
                      ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  Functional Summary
                </button>
              </div>

              {/* Modal body — scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {summaryTab === "business" && (
                  <div>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
                      Used to validate acceptance criteria and ensure changes are appropriate for this application.
                    </p>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {project?.business_summary || "Not yet generated."}
                    </div>
                  </div>
                )}

                {summaryTab === "functional" && (
                  <div>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
                      Used to create new tests and validate existing tests against acceptance criteria.
                    </p>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {project?.functional_summary || "Not yet generated."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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

        </div>{/* End left column */}

        {/* Right Column: AC input + Analysis Results + Run Tests */}
        <div className="space-y-6">
        {/* Acceptance Criteria */}
        {isRepoReady && (
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Acceptance Criteria</h2>
              {acs.length > 0 && (
                <div className="flex gap-2">
                  {acs.some((ac) => ac.analysis_result) && (
                    <button
                      onClick={downloadAllReports}
                      className="rounded-lg border border-purple-300 dark:border-purple-700 px-4 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors"
                    >
                      Download All
                    </button>
                  )}
                  <button
                    onClick={handleAnalyzeAll}
                    disabled={analyzingAll || analyzingAcId !== null}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {analyzingAll
                      ? `Analyzing ${analyzeAllProgress.done}/${analyzeAllProgress.total}...`
                      : "Analyze All"}
                  </button>
                </div>
              )}
            </div>

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
                    {editingAcId === ac.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingAcContent}
                          onChange={(e) => setEditingAcContent(e.target.value)}
                          rows={5}
                          className="w-full rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEditAC}
                            disabled={acSaving || !editingAcContent.trim()}
                            className="rounded border border-green-300 dark:border-green-700 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {acSaving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={handleCancelEditAC}
                            disabled={acSaving}
                            className="rounded border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <pre className="flex-1 text-xs font-mono whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                            {ac.content}
                          </pre>
                          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                            <button
                              onClick={() => handleAnalyze(ac.id)}
                              disabled={analyzingAcId !== null}
                              className="rounded border border-blue-300 dark:border-blue-700 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {analyzingAcId === ac.id ? "Analyzing..." : "Analyze"}
                            </button>
                            {ac.analysis_result && (
                              <button
                                onClick={() => handleViewAnalysis(ac)}
                                className="rounded border border-green-300 dark:border-green-700 px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                              >
                                View
                              </button>
                            )}
                            {ac.analysis_result && (
                              <button
                                onClick={() => downloadReport(ac.analysis_result!, ac.content)}
                                className="rounded border border-purple-300 dark:border-purple-700 px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors"
                              >
                                Download
                              </button>
                            )}
                            <button
                              onClick={() => handleStartEditAC(ac)}
                              className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                              Edit
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
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Analysis Results */}
        {(analysisResult || analysisError || analyzingAcId) && (
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Analysis Results</h2>
              {analysisResult && !analyzingAcId && (
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateAll}
                    disabled={generatingAll || generateAllDone || !activeAcId || generatingKey !== null}
                    className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingAll
                      ? `Generating ${generateAllProgress.done}/${generateAllProgress.total}...`
                      : generateAllDone
                        ? "Generated"
                        : "Generate All"}
                  </button>
                  {generatedScripts.some((s) => s.status === "pending") && (
                    <button
                      onClick={handleAcceptAll}
                      disabled={acceptingAll || acceptingScript}
                      className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {acceptingAll
                        ? `Accepting ${acceptAllProgress.done}/${acceptAllProgress.total}...`
                        : "Accept All"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const ac = acs.find((a) => a.analysis_result === analysisResult) ?? acs[0];
                      downloadReport(analysisResult, ac?.content ?? "");
                    }}
                    className="rounded-lg border border-purple-300 dark:border-purple-700 px-4 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors"
                  >
                    Download Report
                  </button>
                </div>
              )}
            </div>

            {analyzingAcId && (
              <div className="flex items-center gap-3 py-4">
                <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-500">
                  Analyzing acceptance criteria against existing tests...
                </p>
              </div>
            )}

            {analysisError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {analysisError}
              </p>
            )}

            {analysisResult && !analyzingAcId && (() => {
              const appliedSet = new Set(
                generatedScripts
                  .filter((s) => s.status === "applied")
                  .map((s) => {
                    const src = s.source_item as Record<string, unknown>;
                    return src.test_name as string ?? src.scenario_name as string ?? "";
                  })
              );

              const directMatches = analysisResult.matches.filter((m) => m.relevance === "direct");
              const allChangesNeeded = analysisResult.matches.filter((m) => m.relevance === "required changes");
              const changesNeeded = allChangesNeeded.filter((m) => !appliedSet.has(m.test_name));
              const appliedChanges = allChangesNeeded.filter((m) => appliedSet.has(m.test_name));
              const allMissing = analysisResult.missing_scenarios;
              const missingScenarios = allMissing.filter((s) => !appliedSet.has(s.scenario_name));
              const appliedMissing = allMissing.filter((s) => appliedSet.has(s.scenario_name));
              const coveredCount = directMatches.length + appliedChanges.length + appliedMissing.length;

              return (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {analysisResult.summary}
                  </p>

                  {/* Coverage cards — clickable */}
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setResultsPanel(resultsPanel === "covered" ? null : "covered")}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        resultsPanel === "covered"
                          ? "border-green-500 dark:border-green-400 ring-2 ring-green-500/20 bg-green-50 dark:bg-green-950"
                          : "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 hover:border-green-400 dark:hover:border-green-600"
                      }`}
                    >
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {coveredCount}
                      </p>
                      <p className="text-xs font-medium text-green-600 dark:text-green-400">
                        Covered
                      </p>
                      <p className="text-xs text-green-500 dark:text-green-500 mt-1">
                        {directMatches.length} direct{(appliedChanges.length + appliedMissing.length) > 0 ? ` + ${appliedChanges.length + appliedMissing.length} applied` : ""}
                      </p>
                    </button>

                    <button
                      onClick={() => setResultsPanel(resultsPanel === "partial" ? null : "partial")}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        resultsPanel === "partial"
                          ? "border-yellow-500 dark:border-yellow-400 ring-2 ring-yellow-500/20 bg-yellow-50 dark:bg-yellow-950"
                          : "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 hover:border-yellow-400 dark:hover:border-yellow-600"
                      }`}
                    >
                      <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                        {changesNeeded.length}
                      </p>
                      <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                        Partially Covered
                      </p>
                      <p className="text-xs text-yellow-500 dark:text-yellow-500 mt-1">
                        Require changes
                      </p>
                    </button>

                    <button
                      onClick={() => setResultsPanel(resultsPanel === "missing" ? null : "missing")}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        resultsPanel === "missing"
                          ? "border-red-500 dark:border-red-400 ring-2 ring-red-500/20 bg-red-50 dark:bg-red-950"
                          : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 hover:border-red-400 dark:hover:border-red-600"
                      }`}
                    >
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                        {missingScenarios.length}
                      </p>
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">
                        Not Covered
                      </p>
                      <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                        Missing scenarios
                      </p>
                    </button>
                  </div>

                  {/* Detail panels — shown when a card is clicked */}

                  {/* Covered: Direct Matches */}
                  {resultsPanel === "covered" && (
                    <div className="space-y-2">
                      {coveredCount === 0 && (
                        <p className="text-sm text-zinc-400 py-2">
                          No covered scenarios yet.
                        </p>
                      )}
                      {directMatches.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                            Direct Match ({directMatches.length})
                          </p>
                          {directMatches.map((match, i) => (
                            <div
                              key={`direct-${i}`}
                              className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-3 mb-2"
                            >
                              <span className="font-mono text-xs font-semibold">{match.test_name}</span>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1">{match.file_path}</p>
                              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">{match.explanation}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {appliedChanges.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                            Applied Modifications ({appliedChanges.length})
                          </p>
                          {appliedChanges.map((match, i) => {
                            const s = findScript(match.file_path, match.test_name);
                            return (
                              <div
                                key={`applied-mod-${i}`}
                                className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-3 mb-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-xs font-semibold">{match.test_name}</span>
                                  {s && (
                                    <button onClick={() => setViewingScript(s)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                      View Diff
                                    </button>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1">{match.file_path}</p>
                                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">{match.explanation}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {appliedMissing.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                            Applied New Tests ({appliedMissing.length})
                          </p>
                          {appliedMissing.map((scenario, i) => {
                            const s = findScript(scenario.suggested_file, scenario.scenario_name);
                            return (
                              <div
                                key={`applied-new-${i}`}
                                className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-3 mb-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold">{scenario.scenario_name}</span>
                                  {s && (
                                    <button onClick={() => setViewingScript(s)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                      View Code
                                    </button>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">{scenario.description}</p>
                                <p className="text-xs text-zinc-400 font-mono mt-1">{scenario.suggested_file}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Partially Covered: Required Changes */}
                  {resultsPanel === "partial" && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Required Changes ({changesNeeded.length})
                      </p>
                      {changesNeeded.length === 0 && (
                        <p className="text-sm text-zinc-400 py-2">
                          No tests require changes.
                        </p>
                      )}
                      {changesNeeded.map((match, i) => {
                        const existing = findScript(match.file_path, match.test_name);
                        const isGenerating = generatingKey === `modify:${match.file_path}:${match.test_name}`;
                        return (
                          <div
                            key={i}
                            className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 p-3"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-xs font-semibold">
                                {match.test_name}
                              </span>
                              <div className="flex gap-2 shrink-0">
                                {existing ? (
                                  <button
                                    onClick={() => setViewingScript(existing)}
                                    className="rounded border border-green-300 dark:border-green-700 px-2 py-0.5 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                                  >
                                    View Code ({existing.status})
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => activeAcId && handleGenerateModify(activeAcId, match)}
                                    disabled={isGenerating || !activeAcId}
                                    className="rounded border border-purple-300 dark:border-purple-700 px-2 py-0.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 disabled:opacity-50 transition-colors"
                                  >
                                    {isGenerating ? "Generating..." : "Generate Modification"}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mb-1">
                              {match.file_path}
                            </p>
                            <p className="text-xs text-zinc-600 dark:text-zinc-300">
                              {match.explanation}
                            </p>
                            {match.modifications_needed.length > 0 && (
                              <div className="mt-2 border-t border-yellow-200 dark:border-yellow-800 pt-2">
                                <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                                  Modifications needed:
                                </p>
                                <ul className="list-disc list-inside space-y-0.5">
                                  {match.modifications_needed.map((mod, j) => (
                                    <li key={j} className="text-xs text-yellow-600 dark:text-yellow-400">
                                      {mod}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Not Covered: Missing Scenarios */}
                  {resultsPanel === "missing" && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Missing Scenarios ({missingScenarios.length})
                      </p>
                      {missingScenarios.length === 0 && (
                        <p className="text-sm text-zinc-400 py-2">
                          All scenarios are covered.
                        </p>
                      )}
                      {(["high", "medium", "low"] as const).map((priority) => {
                        const scenarios = missingScenarios.filter(
                          (s) => s.priority === priority
                        );
                        if (scenarios.length === 0) return null;
                        const priorityColors = {
                          high: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950",
                          medium: "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950",
                          low: "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800",
                        };
                        const priorityLabels = {
                          high: "High Priority",
                          medium: "Medium Priority",
                          low: "Low Priority",
                        };
                        return (
                          <div key={priority} className="mb-2">
                            <p className="text-xs font-medium text-zinc-400 mb-1">
                              {priorityLabels[priority]} ({scenarios.length})
                            </p>
                            {scenarios.map((scenario, i) => {
                              const existing = findScript(scenario.suggested_file, scenario.scenario_name);
                              const isGenerating = generatingKey === `new:${scenario.scenario_name}`;
                              return (
                                <div
                                  key={i}
                                  className={`rounded-lg border p-3 mb-2 ${priorityColors[priority]}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold">
                                        {scenario.scenario_name}
                                      </span>
                                      <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                                        {scenario.type.replace("_", " ")}
                                      </span>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      {existing ? (
                                        <button
                                          onClick={() => setViewingScript(existing)}
                                          className="rounded border border-green-300 dark:border-green-700 px-2 py-0.5 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                                        >
                                          View Code ({existing.status})
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => activeAcId && handleGenerateNew(activeAcId, scenario)}
                                          disabled={isGenerating || !activeAcId}
                                          className="rounded border border-purple-300 dark:border-purple-700 px-2 py-0.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 disabled:opacity-50 transition-colors"
                                        >
                                          {isGenerating ? "Generating..." : "Generate Test"}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-2">
                                    {scenario.description}
                                  </p>
                                  {scenario.steps.length > 0 && (
                                    <div className="bg-white/60 dark:bg-zinc-900/60 rounded p-2 mb-2">
                                      {scenario.steps.map((step, j) => (
                                        <p key={j} className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                                          {step}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {scenario.suggested_file && (
                                    <p className="text-xs text-zinc-400 font-mono">
                                      Suggested file: {scenario.suggested_file}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
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
        </div>{/* End right column */}

        </div>{/* End grid */}
      </div>

      {/* Generation error toast */}
      {generationError && (
        <div className="fixed bottom-6 right-6 z-40 rounded-lg bg-red-600 text-white px-4 py-3 text-sm shadow-lg">
          <div className="flex items-center gap-3">
            <span>{generationError}</span>
            <button onClick={() => setGenerationError(null)} className="text-white/80 hover:text-white">x</button>
          </div>
        </div>
      )}

      {/* Code viewer modal */}
      {viewingScript && (
        <CodeViewerModal
          script={viewingScript}
          onClose={() => setViewingScript(null)}
          onAccept={handleAcceptScript}
          onReject={handleRejectScript}
          accepting={acceptingScript}
        />
      )}
    </main>
  );
}
