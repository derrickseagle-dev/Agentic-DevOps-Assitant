import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from "lucide-react";
import { useState, useEffect } from "react";

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

  const addStage = () => {
    setStages([
      ...stages,
      {
        id: `stage-${Date.now()}`,
        name: "New Stage",
        type: "script",
        command: "",
        image: "node:20",
        order: stages.length,
      },
    ]);
  };

  const updateStage = (index: number, updates: Partial<NewStage>) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], ...updates };
    setStages(updated);
  };

  const removeStage = (index: number) => {
    if (stages.length <= 1) return;
    setStages(stages.filter((_, i) => i !== index));
  };

  return (
    <div className="mx-auto max-w-3xl">
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
          Define your CI/CD pipeline stages. You can edit them later.
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

        {/* Repository selector */}
        <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
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

        {/* Stages */}
        <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#e4e4f0]">Stages</h2>
            <button
              type="button"
              onClick={addStage}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#333355] px-3 py-1.5 text-xs text-[#8888a0] hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Stage
            </button>
          </div>

          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className={`rounded-lg border p-4 ${
                  stage.type === "checkpoint"
                    ? "border-amber-400/20 bg-amber-400/5"
                    : stage.type === "deploy"
                      ? "border-blue-400/20 bg-blue-400/5"
                      : "border-[#333355] bg-[#0a0a0f]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-[#666680]">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={stage.name}
                        onChange={(e) => updateStage(index, { name: e.target.value })}
                        placeholder="Stage name"
                        className="flex-1 rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-sm text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
                        required
                      />
                      <select
                        value={stage.type}
                        onChange={(e) => {
                          const newType = e.target.value as NewStage["type"];
                          const updates: Partial<NewStage> = { type: newType };
                          if (newType === "checkpoint") {
                            updates.command = "";
                            updates.image = "";
                          }
                          if (newType === "deploy") {
                            updates.environment = "production";
                          }
                          updateStage(index, updates);
                        }}
                        className="rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-sm text-[#e4e4f0] focus:outline-none focus:border-primary"
                      >
                        <option value="script">Script</option>
                        <option value="checkpoint">Approval Gate</option>
                        <option value="deploy">Deploy</option>
                      </select>
                      {stages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStage(index)}
                          className="rounded p-1.5 text-[#666680] hover:bg-red-400/10 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {stage.type !== "checkpoint" && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={stage.command}
                          onChange={(e) => updateStage(index, { command: e.target.value })}
                          placeholder="Command (e.g., npm ci && npm run build)"
                          className="flex-1 rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 font-mono text-xs text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
                          required
                        />
                        <input
                          type="text"
                          value={stage.image}
                          onChange={(e) => updateStage(index, { image: e.target.value })}
                          placeholder="Docker image"
                          className="w-36 rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 font-mono text-xs text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
                        />
                      </div>
                    )}

                    {stage.type === "deploy" && (
                      <input
                        type="text"
                        value={stage.environment || ""}
                        onChange={(e) => updateStage(index, { environment: e.target.value })}
                        placeholder="Environment (staging, production)"
                        className="w-full rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-xs text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
                      />
                    )}

                    {stage.type === "checkpoint" && (
                      <input
                        type="text"
                        value={stage.message || ""}
                        onChange={(e) => updateStage(index, { message: e.target.value })}
                        placeholder="Approval message"
                        className="w-full rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-xs text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
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
