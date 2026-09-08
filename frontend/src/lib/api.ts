// ABOUTME: HTTP client for communicating with the FastAPI backend.
// ABOUTME: All backend calls route through this module.

import type {
  OptimizationRequest,
  OptimizationResponse,
  Project,
  ProjectCreate,
  ProjectUpdate,
  RepoDir,
  SystemDirList,
  TestScript,
  TestScriptCreate,
  TestStats,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// Projects

export async function listProjects(): Promise<Project[]> {
  return request<Project[]>("/projects/");
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${id}`);
}

export async function createProject(payload: ProjectCreate): Promise<Project> {
  return request<Project>("/projects/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProject(
  id: string,
  payload: ProjectUpdate
): Promise<Project> {
  return request<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await request<void>(`/projects/${id}`, { method: "DELETE" });
}

export async function getTestStats(id: string): Promise<TestStats> {
  return request<TestStats>(`/projects/${id}/test-stats`);
}

export async function getRepoDirs(
  id: string,
  path: string = ""
): Promise<RepoDir[]> {
  const params = path ? `?path=${encodeURIComponent(path)}` : "";
  const result = await request<{ dirs: RepoDir[] }>(
    `/projects/${id}/repo-dirs${params}`
  );
  return result.dirs;
}

// System — filesystem browsing

export async function listSystemDirs(path: string = ""): Promise<SystemDirList> {
  const params = path ? `?path=${encodeURIComponent(path)}` : "";
  return request<SystemDirList>(`/system/dirs${params}`);
}

// Optimization

export async function optimize(
  payload: OptimizationRequest
): Promise<OptimizationResponse> {
  return request<OptimizationResponse>("/optimize/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Test Scripts

export async function listTestScripts(): Promise<TestScript[]> {
  return request<TestScript[]>("/test-scripts/");
}

export async function getTestScript(id: string): Promise<TestScript> {
  return request<TestScript>(`/test-scripts/${id}`);
}

export async function createTestScript(
  payload: TestScriptCreate
): Promise<TestScript> {
  return request<TestScript>("/test-scripts/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
