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
  test_path: string | null;
  business_summary: string | null;
  functional_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  repo_type: "local" | "github";
  repo_url: string;
  clone_path?: string;
  git_token?: string;
  force_init_git?: boolean;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  test_path?: string | null;
}

export interface RepoDir {
  name: string;
  path: string;
  has_children: boolean;
}

export interface SystemDir {
  name: string;
  path: string;
  has_children: boolean;
}

export interface SystemDirList {
  current_path: string;
  parent_path: string | null;
  dirs: SystemDir[];
}

export interface TestFile {
  path: string;
  name: string;
  tests: string[];
}

export interface TestDirectory {
  directory: string;
  files: TestFile[];
}

export interface TestStats {
  total_files: number;
  total_tests: number;
  frameworks: string[];
  breakdown: Record<string, number>;
  test_directories: string[];
  test_tree: TestDirectory[];
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

export interface SettingsRead {
  llm_provider: string;
  llm_base_url: string;
  llm_model: string;
  has_api_key: boolean;
  updated_at: string | null;
}

export interface SettingsUpdate {
  llm_provider?: string;
  llm_base_url?: string;
  llm_api_key?: string;
  llm_model?: string;
}

export interface ConnectionTestRequest {
  llm_provider: string;
  llm_base_url: string;
  llm_api_key: string;
  llm_model: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  model_used: string | null;
}

export interface AnalysisRequest {
  ac_id: string;
}

export interface MatchedTest {
  file_path: string;
  test_name: string;
  relevance: "direct" | "required changes";
  explanation: string;
  modifications_needed: string[];
}

export interface MissingScenario {
  scenario_name: string;
  type: "positive" | "negative" | "edge_case" | "boundary";
  description: string;
  steps: string[];
  priority: "high" | "medium" | "low";
  suggested_file: string;
}

export interface CoverageAssessment {
  covered: string[];
  partially_covered: string[];
  not_covered: string[];
}

export interface AnalysisResult {
  matches: MatchedTest[];
  missing_scenarios: MissingScenario[];
  summary: string;
  coverage_assessment: CoverageAssessment | null;
}

export interface GenerateModifyRequest {
  ac_id: string;
  file_path: string;
  test_name: string;
  modifications_needed: string[];
}

export interface GenerateNewRequest {
  ac_id: string;
  scenario_name: string;
  scenario_type: string;
  description: string;
  steps: string[];
  priority: string;
  suggested_file: string;
}

export interface GeneratedScript {
  id: string;
  project_id: string;
  ac_id: string;
  action: "modify" | "generate" | "append";
  status: "pending" | "applied" | "rejected";
  file_path: string;
  source_item: Record<string, unknown>;
  original_content: string | null;
  generated_content: string;
  created_at: string;
  updated_at: string;
}

export interface ApplyScriptResponse {
  success: boolean;
  file_path: string;
  message: string;
}

export interface ACCreate {
  content: string;
}

export interface ACRead {
  id: string;
  project_id: string;
  content: string;
  analysis_result: AnalysisResult | null;
  created_at: string;
  updated_at: string;
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
