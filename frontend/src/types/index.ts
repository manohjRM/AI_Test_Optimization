// ABOUTME: Shared TypeScript types mirroring the backend API schemas.
// ABOUTME: Keeps frontend/backend contracts in sync.

export interface Project {
  id: string;
  name: string;
  description: string | null;
  repo_type: "local" | "github";
  repo_url: string;
  local_path: string | null;
  repo_status: "pending" | "valid" | "cloning" | "cloned" | "error";
  repo_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  repo_type: "local" | "github";
  repo_url: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
}

export interface TestStats {
  total_files: number;
  frameworks: string[];
  breakdown: Record<string, number>;
  test_directories: string[];
}

export interface OptimizationRequest {
  user_input: string;
  existing_script?: string;
  framework: string;
  language: string;
}

export interface OptimizationResponse {
  original_script: string | null;
  optimized_script: string;
  explanation: string;
  suggestions: string[];
}

export interface TestScript {
  id: string;
  name: string;
  description: string | null;
  content: string;
  framework: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface TestScriptCreate {
  name: string;
  description?: string;
  content: string;
  framework?: string;
  language?: string;
}
