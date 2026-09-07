// ABOUTME: HTTP client for communicating with the FastAPI backend.
// ABOUTME: All backend calls route through this module.

import type {
  OptimizationRequest,
  OptimizationResponse,
  TestScript,
  TestScriptCreate,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function optimize(
  payload: OptimizationRequest
): Promise<OptimizationResponse> {
  return request<OptimizationResponse>("/optimize/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

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
