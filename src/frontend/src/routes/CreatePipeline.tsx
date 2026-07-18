import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { ArrowLeft, Plus, Sparkles, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import PipelineDAG from "../components/pipeline/PipelineDAG";
import type { DAGStage } from "../components/pipeline/PipelineDAG";

interface NewStage {
  id: string;
  name: string;
  type: "script" | "checkpoint" | "deploy";
  command: string;
  image: string;
  order: number;
  environment?: string;
  message?: string;
}

const DEFAULT_STAGES: NewStage[] = [
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
    command: "npm test",
    image: "node:20",
    order: 1,
  },
  {
    id: "stage-3",
    name: "QA Approval",
    type: "checkpoint",
    command: "",
    image: "",
    message: "Please verify staging looks good",
    order: 2,
  },
];

export default function CreatePipeline() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const teamId = user?.teams?.[0]?.teamId;
  const queryClient = useQueryClient();
  const preselectedRepoId = searchParams.get("repoId");

  const [name, setName] = useState("");
  const [repoId, setRepoId] = useState(preselectedRepoId || "");
  const [stages, setStages] = useState<NewStage[]>(DEFAULT_STAGES);
  const [error, setError] = useState<string | null>(null);

  // AI generation state
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState<"idle" | "analyzing" | "generating" | "done">("idle");
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Fetch connected repos for the dropdown
  const { data: reposData, isLoading: loadingRepos } = useQuery({
    queryKey: ["repositories", teamId],
    queryFn: () => api.listRepositories(teamId!),
    enabled: !!teamId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createPipeline(teamId!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pipelines", teamId] });
      navigate(`/pipelines/${result.id}`);
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create pipeline");
    },
  });

  const repos = reposData?.repositories ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Pipeline name is required");
      return;
    }
    if (!repoId) {
      setError("Please select a repository");
      return;
    }
    if (stages.length === 0) {
      setError("At least one stage is required");
      return;
    }

    // Validate stages
    for (const stage of stages) {
      if (!stage.name.trim()) {
        setError(`Stage "${stage.id}" must have a name`);
        return;
      }
      if (stage.type !== "checkpoint" && !stage.command?.trim()) {
        setError(`Stage "${stage.name}" must have a command`);
        return;
      }
    }

    createMutation.mutate({
      repositoryId: repoId,
      name: name.trim(),
      triggerMode: "manual",
      config: {
        stages: stages.map((s, i) => ({
          ...s,
          order: i,
        })),
      },
    });
  };

  // ============================================================
  // AI Generation flow: analyze → generate → show DAG
  // ============================================================
  const handleGenerateAI = async () => {
    if (!teamId || !repoId) {
      setError("Please select a repository first");
      return;
    }

    setError(null);
    setGenerating(true);
    setGenStep("analyzing");

    try {
      // Step 1: Analyze repo
      const analysisResp = await api.analyzeRepo(teamId, repoId);
      setAnalysisResult(analysisResp.analysis);
      setGenStep("generating");

      // Step 2: Generate pipeline
      const genResp = await api.generatePipeline(teamId, repoId);
      const generatedStages: NewStage[] = (genResp.pipeline?.stages || []).map(
        (s: any, i: number) => ({
          id: s.id || `gen-stage-${i}`,
          name: s.name || `Stage ${i + 1}`,
          type: s.type || "script",
          command: s.command || "",
          image: s.image || "node:20",
          order: i,
          environment: s.environment,
          message: s.message,
        })
      );

      if (generatedStages.length > 0) {
        setStages(generatedStages);
      }

      // Auto-fill name from repo if empty
      if (!name.trim() && repos.length > 0) {
        const selectedRepo = repos.find((r: any) => r.id === repoId);
        if (selectedRepo) {
          setName(`${selectedRepo.name || selectedRepo.fullName} Pipeline`);
        }
      }

      setGenStep("done");
    } catch (err: any) {
      setError(err.message || "AI generation failed. Please try again or build manually.");
      setGenStep("idle");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/pipelines"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#8888a0] hover:text-[#e4e4f0] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pipelines
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e4e4f0]">Create Pipeline</h1>
        <p className="mt-1 text-sm text-[#8888a0]">
          Define your CI/CD pipeline stages manually or generate them with AI.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pipeline name */}
        <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
          <label className="mb-2 block text-sm font-medium text-[#e4e4f0]">
            Pipeline Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Production Deploy"
            className="w-full rounded-lg border border-[#333355] bg-[#0a0a0f] px-4 py-2.5 text-sm text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
          />
        </div>

        {/* Repository selector + Generate button */}
        <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-[#e4e4f0]">
                Repository
              </label>
              {loadingRepos ? (
                <div className="h-10 animate-pulse rounded-lg bg-[#0a0a0f]" />
              ) : repos.length === 0 ? (
                <div className="rounded-lg border border-[#333355] bg-[#0a0a0f] p-4 text-center">
                  <p className="text-sm text-[#8888a0]">
                    No repositories connected.{" "}
                    <Link to="/repositories" className="text-primary hover:underline">
                      Connect one first
                    </Link>
                  </p>
                </div>
              ) : (
                <select
                  value={repoId}
                  onChange={(e) => setRepoId(e.target.value)}
                  className="w-full rounded-lg border border-[#333355] bg-[#0a0a0f] px-4 py-2.5 text-sm text-[#e4e4f0] focus:outline-none focus:border-primary"
                  required
                >
                  <option value="">Select a repository...</option>
                  {repos.map((repo: any) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName || repo.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Generate AI button */}
            <button
              type="button"
              onClick={handleGenerateAI}
              disabled={generating || !repoId}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-primary px-4 py-2.5 text-sm font-medium text-white hover:from-purple-600 hover:to-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {genStep === "analyzing" ? "Analyzing repo..." : "Generating..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </>
              )}
            </button>
          </div>

          {/* Analysis results after generation */}
          {analysisResult && genStep === "done" && (
            <div className="mt-4 rounded-lg border border-purple-400/20 bg-purple-400/5 p-4">
              <h4 className="text-sm font-semibold text-purple-400 mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Analysis Results
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs text-[#8888a0]">
                {analysisResult.primaryLanguage && (
                  <div>
                    <span className="font-medium text-[#e4e4f0]">Language:</span>{" "}
                    {analysisResult.primaryLanguage}
                  </div>
                )}
                {analysisResult.framework && (
                  <div>
                    <span className="font-medium text-[#e4e4f0]">Framework:</span>{" "}
                    {analysisResult.framework}
                  </div>
                )}
                {analysisResult.buildTool && (
                  <div>
                    <span className="font-medium text-[#e4e4f0]">Build Tool:</span>{" "}
                    {analysisResult.buildTool}
                  </div>
                )}
                {analysisResult.testFramework && (
                  <div>
                    <span className="font-medium text-[#e4e4f0]">Test:</span>{" "}
                    {analysisResult.testFramework}
                  </div>
                )}
                {analysisResult.deploymentHints?.length > 0 && (
                  <div className="col-span-2">
                    <span className="font-medium text-[#e4e4f0]">Deployment Hints:</span>{" "}
                    {analysisResult.deploymentHints.join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stages — DAG Editor */}
        <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#e4e4f0]">
              Pipeline Stages {genStep === "done" && <span className="text-xs text-purple-400 font-normal ml-2">(AI-generated)</span>}
            </h2>
          </div>

          <PipelineDAG
            stages={stages as DAGStage[]}
            onStagesChange={(updated) => setStages(updated as NewStage[])}
          />

          {/* Stage count summary */}
          <div className="mt-4 text-xs text-[#666680]">
            {stages.length} stage{stages.length !== 1 ? "s" : ""} defined
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link
            to="/pipelines"
            className="inline-flex items-center gap-2 rounded-lg border border-[#333355] px-4 py-2 text-sm font-medium text-[#e4e4f0] hover:bg-[#1a1a2e] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {createMutation.isPending ? "Creating..." : "Create Pipeline"}
          </button>
        </div>
      </form>
    </div>
  );
}
