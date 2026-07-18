import { Octokit } from "octokit";
import OpenAI from "openai";
import { z } from "zod";
import { pipelineStageSchema, pipelineConfigSchema } from "../../../shared/src/schemas";

// ============================================================
// Repo Analysis Types
// ============================================================

export interface RepoAnalysis {
  repositoryId: string;
  fullName: string;
  defaultBranch: string;
  primaryLanguage: string | null;
  languages: string[];
  framework: string | null;
  buildTool: string | null;
  testFramework: string | null;
  deploymentHints: string[];
  keyFiles: string[];
  existingCiConfigs: string[];
  readmeExcerpt: string | null;
}

// ============================================================
// Key file patterns for analysis
// ============================================================

const KEY_FILE_PATTERNS = [
  "package.json",
  "Dockerfile",
  "Makefile",
  "go.mod",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "Gemfile",
  "build.gradle",
  "pom.xml",
  "CMakeLists.txt",
  "docker-compose.yml",
  ".github/workflows/",
];

const CI_PATH_PREFIXES = [".github/workflows/", ".gitlab-ci.yml", ".circleci/", "Jenkinsfile"];

// ============================================================
// Framework / Tool Detection
// ============================================================

function detectFramework(language: string | null, fileContents: Map<string, string>): string | null {
  const packageJson = fileContents.get("package.json");
  if (packageJson && language === "TypeScript") {
    try {
      const pkg = JSON.parse(packageJson);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps["next"]) return "Next.js";
      if (deps["react"]) return "React";
      if (deps["vue"]) return "Vue.js";
      if (deps["@angular/core"]) return "Angular";
      if (deps["express"]) return "Express";
      if (deps["fastify"]) return "Fastify";
      if (deps["hono"]) return "Hono";
      if (deps["@nestjs/core"]) return "NestJS";
      return "Node.js";
    } catch {}
  }

  if (packageJson && language === "JavaScript") {
    try {
      const pkg = JSON.parse(packageJson);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps["next"]) return "Next.js";
      if (deps["react"]) return "React";
      if (deps["express"]) return "Express";
      return "Node.js";
    } catch {}
  }

  const requirementsTxt = fileContents.get("requirements.txt");
  if (requirementsTxt && language === "Python") {
    const content = requirementsTxt.toLowerCase();
    if (content.includes("django")) return "Django";
    if (content.includes("flask")) return "Flask";
    if (content.includes("fastapi")) return "FastAPI";
    return "Python";
  }

  const pyproject = fileContents.get("pyproject.toml");
  if (pyproject && language === "Python") {
    const content = pyproject.toLowerCase();
    if (content.includes("django")) return "Django";
    if (content.includes("fastapi")) return "FastAPI";
    return "Python";
  }

  const goMod = fileContents.get("go.mod");
  if (goMod && language === "Go") {
    return "Go";
  }

  const cargoToml = fileContents.get("Cargo.toml");
  if (cargoToml && language === "Rust") {
    return "Rust";
  }

  return language || null;
}

function detectBuildTool(language: string | null, fileContents: Map<string, string>): string | null {
  const packageJson = fileContents.get("package.json");
  if (packageJson && (language === "TypeScript" || language === "JavaScript")) {
    try {
      const pkg = JSON.parse(packageJson);
      const scripts = pkg.scripts || {};
      if (scripts.build) {
        // Check what build tool is used
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps["vite"]) return "Vite";
        if (allDeps["webpack"]) return "Webpack";
        if (allDeps["tsup"]) return "tsup";
        if (allDeps["esbuild"]) return "esbuild";
      }
      return "npm";
    } catch {}
  }

  if (fileContents.has("Makefile")) return "Make";
  if (language === "Go") return "go build";
  if (language === "Rust") return "cargo";
  if (language === "Python") return "pip/setuptools";

  return null;
}

function detectTestFramework(language: string | null, fileContents: Map<string, string>): string | null {
  const packageJson = fileContents.get("package.json");
  if (packageJson && (language === "TypeScript" || language === "JavaScript")) {
    try {
      const pkg = JSON.parse(packageJson);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps["vitest"]) return "Vitest";
      if (deps["jest"]) return "Jest";
      if (deps["mocha"]) return "Mocha";
      if (deps["ava"]) return "AVA";
      if (deps["jasmine"]) return "Jasmine";
      return "npm test";
    } catch {}
  }

  const requirementsTxt = fileContents.get("requirements.txt");
  if (requirementsTxt && language === "Python") {
    const content = requirementsTxt.toLowerCase();
    if (content.includes("pytest")) return "pytest";
    if (content.includes("unittest")) return "unittest";
    return "pytest";
  }

  if (language === "Go") return "go test";
  if (language === "Rust") return "cargo test";

  return null;
}

function detectDeploymentHints(fileContents: Map<string, string>): string[] {
  const hints: string[] = [];

  if (fileContents.has("Dockerfile")) {
    hints.push("Docker-based deployment detected (Dockerfile present)");
  }

  if (fileContents.has("docker-compose.yml")) {
    hints.push("Docker Compose configuration present");
  }

  const workflowsDir = ".github/workflows/";
  for (const [filePath] of fileContents) {
    if (filePath.startsWith(workflowsDir)) {
      hints.push(`CI workflow found in ${filePath}`);
    }
  }

  // Check for Vercel
  if (fileContents.get("vercel.json")) {
    hints.push("Vercel deployment configuration detected");
  }

  // Check for AWS
  for (const [filePath, content] of fileContents) {
    if (filePath.includes("serverless") && (filePath.endsWith(".yml") || filePath.endsWith(".yaml"))) {
      hints.push("Serverless Framework configuration detected");
    }
    if (filePath.includes("terraform") && filePath.endsWith(".tf")) {
      hints.push("Terraform configuration detected");
    }
  }

  return hints;
}

// ============================================================
// Main Analysis Function
// ============================================================

export async function analyzeRepository(
  octokit: Octokit,
  owner: string,
  repo: string,
  defaultBranch: string,
  repositoryId: string,
  fullName: string,
  knownLanguage: string | null,
): Promise<RepoAnalysis> {
  // Step 1: Get repo metadata from GitHub API
  let repoMetadata: any = null;
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo });
    repoMetadata = data;
  } catch (err) {
    console.warn("[ai-generator] Could not fetch repo metadata, continuing with limited info");
  }

  const primaryLanguage = knownLanguage || repoMetadata?.language || null;
  const languages: string[] = [];

  // Get languages
  try {
    const { data: langData } = await octokit.rest.repos.listLanguages({ owner, repo });
    // Sort by byte count descending, take top 3
    languages.push(
      ...Object.entries(langData as Record<string, number>)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([lang]) => lang),
    );
  } catch {
    if (primaryLanguage) languages.push(primaryLanguage);
  }

  // Step 2: Scan root directory for key files
  const fileContents = new Map<string, string>();
  const keyFiles: string[] = [];
  const existingCiConfigs: string[] = [];

  // Use Git Trees API to get file listing
  try {
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: "true",
    });

    const tree = treeData.tree;

    // Filter to relevant files (root-ish + important subdirs)
    const relevantPaths: string[] = [];

    for (const item of tree) {
      if (!item.path || item.type !== "blob") continue;

      // Key files at root
      const isKeyRootFile = KEY_FILE_PATTERNS.some((pattern) => {
        if (pattern.endsWith("/")) {
          return item.path!.startsWith(pattern) && item.path!.endsWith(".yml");
        }
        return item.path === pattern;
      });

      if (isKeyRootFile) {
        relevantPaths.push(item.path);
        keyFiles.push(item.path);

        if (item.path.startsWith(".github/workflows/")) {
          existingCiConfigs.push(item.path);
        }
        continue;
      }

      // Also capture README
      if (item.path.toLowerCase() === "readme.md") {
        relevantPaths.push(item.path);
        keyFiles.push(item.path);
        continue;
      }

      // Capture CI configs
      for (const prefix of CI_PATH_PREFIXES) {
        if (item.path.startsWith(prefix)) {
          relevantPaths.push(item.path);
          existingCiConfigs.push(item.path);
          break;
        }
      }
    }

    // Fetch contents of discovered key files (limit to 15 to be safe)
    const filesToFetch = relevantPaths.slice(0, 15);
    for (const filePath of filesToFetch) {
      try {
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
          ref: defaultBranch,
        });

        if (!Array.isArray(fileData) && fileData.type === "file" && fileData.content) {
          const decoded = Buffer.from(fileData.content, "base64").toString("utf-8");
          // Truncate large files
          fileContents.set(filePath, decoded.slice(0, 5000));
        }
      } catch {
        // Skip files we can't read
      }
    }
  } catch (err) {
    console.warn("[ai-generator] Could not scan repo tree:", err);
  }

  // Step 3: Detect framework, build tool, test framework
  const framework = detectFramework(primaryLanguage, fileContents);
  const buildTool = detectBuildTool(primaryLanguage, fileContents);
  const testFramework = detectTestFramework(primaryLanguage, fileContents);
  const deploymentHints = detectDeploymentHints(fileContents);

  // Step 4: Extract README excerpt
  let readmeExcerpt: string | null = null;
  const readmeContent = fileContents.get("README.md");
  if (readmeContent) {
    readmeExcerpt = readmeContent.slice(0, 1000);
  }

  return {
    repositoryId,
    fullName,
    defaultBranch,
    primaryLanguage,
    languages,
    framework,
    buildTool,
    testFramework,
    deploymentHints,
    keyFiles,
    existingCiConfigs,
    readmeExcerpt,
  };
}

// ============================================================
// LLM Integration
// ============================================================

const llmOutputSchema = z.object({
  stages: z
    .array(pipelineStageSchema)
    .min(1, "Pipeline must have at least one stage"),
});

function getLLMClient(): OpenAI {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY environment variable is not configured");
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.LLM_API_BASE || "https://api.openai.com/v1",
  });
}

function buildGenerationPrompt(analysis: RepoAnalysis): string {
  const context = {
    repository: analysis.fullName,
    primaryLanguage: analysis.primaryLanguage || "Unknown",
    languages: analysis.languages,
    framework: analysis.framework || "Not detected",
    buildTool: analysis.buildTool || "Not detected",
    testFramework: analysis.testFramework || "Not detected",
    deploymentHints: analysis.deploymentHints,
    keyFiles: analysis.keyFiles,
    existingCiConfigs: analysis.existingCiConfigs,
    readmeExcerpt: analysis.readmeExcerpt?.slice(0, 500) || null,
  };

  return `You are an expert CI/CD pipeline engineer. Given the following repository analysis, generate a complete pipeline configuration.

## Repository Analysis
${JSON.stringify(context, null, 2)}

## Instructions
1. Create a pipeline with stages that follow CI/CD best practices for the detected language and framework.
2. The pipeline MUST include: a build/install stage, a test stage, and an approval checkpoint before any deploy stage.
3. If a Dockerfile is detected, include a Docker build stage.
4. Stage types must be one of: "script", "checkpoint", "deploy".
5. Each stage must have a unique "id" (use "stage-1", "stage-2", etc.), "name", "type", and "order" (starting at 0).
6. "script" and "deploy" stages need a "command" (shell command to run) and "image" (Docker image like "node:20").
7. "checkpoint" stages need a "message" explaining what the approver should verify.
8. "deploy" stages need an "environment" field (e.g., "staging", "production").

## Output Format
Return ONLY valid JSON matching this schema:
{
  "stages": [
    {
      "id": "stage-1",
      "name": "Install & Build",
      "type": "script",
      "command": "npm ci && npm run build",
      "image": "node:20",
      "order": 0
    }
  ]
}

Do NOT include any explanation, markdown fences, or text outside the JSON object.`;
}

function buildCorrectionPrompt(analysis: RepoAnalysis, rawResponse: string, errorMessage: string): string {
  return `Your previous response was not valid JSON matching the required schema.

## Error
${errorMessage}

## Previous Response
${rawResponse.slice(0, 2000)}

## Repository Analysis (reminder)
${JSON.stringify({
    repository: analysis.fullName,
    primaryLanguage: analysis.primaryLanguage,
    framework: analysis.framework,
    buildTool: analysis.buildTool,
    testFramework: analysis.testFramework,
    deploymentHints: analysis.deploymentHints,
  }, null, 2)}

Please generate ONLY valid JSON matching this schema:
{
  "stages": [
    {
      "id": "stage-1",
      "name": "...",
      "type": "script",
      "command": "...",
      "image": "node:20",
      "order": 0
    }
  ]
}

Return ONLY the JSON object — no markdown, no explanation.`;
}

export async function generatePipelineFromAnalysis(
  analysis: RepoAnalysis,
): Promise<{ stages: z.infer<typeof pipelineStageSchema>[] }> {
  // Check if LLM is available
  if (!process.env.LLM_API_KEY) {
    console.log("[ai-generator] No LLM API key configured, using fallback template");
    return buildFallbackPipeline(analysis);
  }

  let openai: OpenAI;
  try {
    openai = getLLMClient();
  } catch (err) {
    console.warn("[ai-generator] Failed to initialize LLM client, using fallback:", err);
    return buildFallbackPipeline(analysis);
  }

  const model = process.env.LLM_MODEL || "gpt-4o";

  // Attempt 1
  let rawResponse: string;
  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a CI/CD pipeline configuration generator. You output only valid JSON. Never include markdown fences or explanations." },
        { role: "user", content: buildGenerationPrompt(analysis) },
      ],
      max_tokens: 2000,
    });

    rawResponse = completion.choices[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("[ai-generator] LLM API call failed, using fallback:", err);
    return buildFallbackPipeline(analysis);
  }

  if (!rawResponse) {
    console.warn("[ai-generator] Empty LLM response, using fallback");
    return buildFallbackPipeline(analysis);
  }

  // Try to parse and validate
  function tryParseJSON(text: string): any {
    // Remove markdown fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    }
    return JSON.parse(cleaned);
  }

  let parsed: any;
  try {
    parsed = tryParseJSON(rawResponse);
  } catch {
    // Retry once with correction prompt
    console.warn("[ai-generator] Failed to parse LLM response as JSON, retrying...");
    try {
      const retryCompletion = await openai.chat.completions.create({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: "You output only valid JSON. No markdown, no explanation." },
          { role: "user", content: buildCorrectionPrompt(analysis, rawResponse, "Response was not valid JSON") },
        ],
        max_tokens: 2000,
      });

      const retryRaw = retryCompletion.choices[0]?.message?.content?.trim() || "";
      parsed = tryParseJSON(retryRaw);
    } catch (retryErr) {
      console.error("[ai-generator] Retry also failed, using fallback:", retryErr);
      return buildFallbackPipeline(analysis);
    }
  }

  // Validate with Zod
  const result = llmOutputSchema.safeParse(parsed);
  if (result.success) {
    // Re-index orders to be sequential
    result.data.stages = result.data.stages.map((stage, i) => ({
      ...stage,
      order: i,
    }));
    return result.data;
  }

  // Zod validation failed — retry once
  console.warn("[ai-generator] Zod validation failed, retrying:", result.error.flatten());
  try {
    const retryCompletion = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: "You output only valid JSON. No markdown, no explanation." },
        { role: "user", content: buildCorrectionPrompt(analysis, rawResponse, JSON.stringify(result.error.flatten())) },
      ],
      max_tokens: 2000,
    });

    const retryRaw = retryCompletion.choices[0]?.message?.content?.trim() || "";
    const retryParsed = tryParseJSON(retryRaw);
    const retryResult = llmOutputSchema.safeParse(retryParsed);

    if (retryResult.success) {
      retryResult.data.stages = retryResult.data.stages.map((stage, i) => ({
        ...stage,
        order: i,
      }));
      return retryResult.data;
    }
  } catch (retryErr) {
    console.error("[ai-generator] Retry failed:", retryErr);
  }

  console.warn("[ai-generator] All LLM attempts failed, using fallback");
  return buildFallbackPipeline(analysis);
}

// ============================================================
// Fallback Pipeline Templates
// ============================================================

function buildFallbackPipeline(analysis: RepoAnalysis): { stages: z.infer<typeof pipelineStageSchema>[] } {
  const lang = analysis.primaryLanguage?.toLowerCase() || "";
  const framework = analysis.framework?.toLowerCase() || "";
  const hasDocker = analysis.keyFiles.some((f) => f.toLowerCase() === "dockerfile");

  // Node.js / TypeScript / JavaScript default
  if (lang === "typescript" || lang === "javascript" || analysis.keyFiles.includes("package.json")) {
    const stages: any[] = [
      {
        id: "stage-1",
        name: "Install & Build",
        type: "script",
        command: "npm ci && npm run build",
        image: "node:20",
        order: 0,
      },
      {
        id: "stage-2",
        name: "Run Tests",
        type: "script",
        command: analysis.testFramework === "Vitest"
          ? "npx vitest run"
          : analysis.testFramework === "Jest"
            ? "npx jest"
            : "npm test",
        image: "node:20",
        order: 1,
      },
    ];

    if (hasDocker) {
      stages.push({
        id: "stage-3",
        name: "Build Docker Image",
        type: "script",
        command: "docker build -t ${IMAGE_TAG} .",
        image: "docker:24",
        order: 2,
      });
    }

    stages.push({
      id: hasDocker ? "stage-4" : "stage-3",
      name: "QA Approval",
      type: "checkpoint",
      message: "Please verify the build and tests pass before deploying",
      order: hasDocker ? 3 : 2,
    });

    stages.push({
      id: hasDocker ? "stage-5" : "stage-4",
      name: "Deploy",
      type: "deploy",
      environment: "production",
      command: hasDocker ? "docker push ${IMAGE_TAG}" : "# Add deployment command here",
      image: hasDocker ? "docker:24" : "node:20",
      order: hasDocker ? 4 : 3,
    });

    return { stages };
  }

  // Python
  if (lang === "python") {
    const stages: any[] = [
      {
        id: "stage-1",
        name: "Install Dependencies",
        type: "script",
        command: "pip install -r requirements.txt",
        image: "python:3.12",
        order: 0,
      },
      {
        id: "stage-2",
        name: "Run Tests",
        type: "script",
        command: "pytest",
        image: "python:3.12",
        order: 1,
      },
      {
        id: "stage-3",
        name: "QA Approval",
        type: "checkpoint",
        message: "Please verify tests pass before deploying",
        order: 2,
      },
      {
        id: "stage-4",
        name: "Deploy",
        type: "deploy",
        environment: "production",
        command: "# Add deployment command here",
        image: "python:3.12",
        order: 3,
      },
    ];

    if (hasDocker) {
      stages.splice(2, 0, {
        id: "stage-docker",
        name: "Build Docker Image",
        type: "script",
        command: "docker build -t ${IMAGE_TAG} .",
        image: "docker:24",
        order: 2,
      });
      // Fix orders
      stages.forEach((s, i) => { s.order = i; });
    }

    return { stages };
  }

  // Go
  if (lang === "go") {
    const stages: any[] = [
      {
        id: "stage-1",
        name: "Build",
        type: "script",
        command: "go build -o app ./...",
        image: "golang:1.22",
        order: 0,
      },
      {
        id: "stage-2",
        name: "Run Tests",
        type: "script",
        command: "go test ./...",
        image: "golang:1.22",
        order: 1,
      },
      {
        id: "stage-3",
        name: "QA Approval",
        type: "checkpoint",
        message: "Please verify tests pass before deploying",
        order: 2,
      },
      {
        id: "stage-4",
        name: "Deploy",
        type: "deploy",
        environment: "production",
        command: "# Add deployment command here",
        image: "golang:1.22",
        order: 3,
      },
    ];
    return { stages };
  }

  // Generic fallback
  return {
    stages: [
      {
        id: "stage-1",
        name: "Build",
        type: "script",
        command: "# Add your build command here",
        image: "ubuntu:22.04",
        order: 0,
      },
      {
        id: "stage-2",
        name: "Test",
        type: "script",
        command: "# Add your test command here",
        image: "ubuntu:22.04",
        order: 1,
      },
      {
        id: "stage-3",
        name: "QA Approval",
        type: "checkpoint",
        message: "Please verify everything looks good before deploying",
        order: 2,
      },
      {
        id: "stage-4",
        name: "Deploy",
        type: "deploy",
        environment: "production",
        command: "# Add your deploy command here",
        image: "ubuntu:22.04",
        order: 3,
      },
    ],
  };
}
