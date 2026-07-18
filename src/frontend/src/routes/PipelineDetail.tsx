import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import {
  ArrowLeft,
  GitBranch,
  Play,
  Pause,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";

interface Stage {
  id: string;
  name: string;
  type: "script" | "checkpoint" | "deploy";
  command?: string;
  image?: string;
  environment?: string;
  approvers?: string[];
  message?: string;
  order: number;
}

export default function PipelineDetail() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const teamId = user?.teams?.[0]?.teamId;
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStages, setEditStages] = useState<Stage[]>([]);
  const [editJsonText, setEditJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pipeline", teamId, pipelineId],
    queryFn: () => api.getPipeline(teamId!, pipelineId!),
    enabled: !!teamId && !!pipelineId,
  });

  const updateMutation = useMutation({
    mutationFn: (updateData: any) =>
      api.updatePipeline(teamId!, pipelineId!, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", teamId, pipelineId] });
      queryClient.invalidateQueries({ queryKey: ["pipelines", teamId] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deletePipeline(teamId!, pipelineId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines", teamId] });
      navigate("/pipelines");
    },
  });

  const pipeline = data;
  const config = pipeline?.config;
  const stages: Stage[] = config?.stages ?? [];

  useEffect(() => {
    if (pipeline && !isEditing) {
      setEditName(pipeline.name);
      setEditStages(stages);
    }
  }, [pipeline, isEditing]);

  const startEditing = (mode: "json" | "form") => {
    setEditName(pipeline.name);
    setEditStages([...stages]);
    setEditJsonText(JSON.stringify({ stages: editStages }, null, 2));
    setJsonError(null);
    setIsEditing(true);
  };

  const handleJsonEdit = () => {
    try {
      const parsed = JSON.parse(editJsonText);
      if (!parsed.stages || !Array.isArray(parsed.stages)) {
        setJsonError("Config must have a 'stages' array");
        return;
      }
      setEditStages(parsed.stages);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      name: editName,
      config: { stages: editStages },
    });
  };

  const addStage = () => {
    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      name: "New Stage",
      type: "script",
      command: "",
      image: "node:20",
      order: editStages.length,
    };
    setEditStages([...editStages, newStage]);
  };

  const updateStage = (index: number, updates: Partial<Stage>) => {
    const updated = [...editStages];
    updated[index] = { ...updated[index], ...updates };
    setEditStages(updated);
  };

  const removeStage = (index: number) => {
    setEditStages(editStages.filter((_, i) => i !== index));
  };

  const getStageTypeLabel = (type: string) => {
    switch (type) {
      case "script": return "Script";
      case "checkpoint": return "Approval Gate";
      case "deploy": return "Deploy";
      default: return type;
    }
  };

  const getStageTypeColor = (type: string) => {
    switch (type) {
      case "script": return "border-[#333355] bg-[#1a1a2e]";
      case "checkpoint": return "border-amber-400/20 bg-amber-400/5";
      case "deploy": return "border-blue-400/20 bg-blue-400/5";
      default: return "border-[#333355] bg-[#1a1a2e]";
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
      paused: "bg-amber-400/10 text-amber-400 border-amber-400/20",
      draft: "bg-[#333355]/50 text-[#8888a0] border-[#333355]",
    };
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] || styles.draft}`}>
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="h-96 animate-pulse rounded-xl bg-[#131320]" />
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-6 text-center">
          <p className="text-red-400">Pipeline not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back navigation */}
      <Link
        to="/pipelines"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#8888a0] hover:text-[#e4e4f0] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pipelines
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-2xl font-bold bg-transparent text-[#e4e4f0] border-b border-[#333355] focus:outline-none focus:border-primary"
            />
          ) : (
            <h1 className="text-2xl font-bold text-[#e4e4f0]">{pipeline.name}</h1>
          )}
          <div className="mt-2 flex items-center gap-3 text-sm text-[#8888a0]">
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" />
              {pipeline.repoFullName || pipeline.repoName}
            </span>
            <span>•</span>
            <span>Trigger: {pipeline.triggerMode}</span>
            <span>•</span>
            {getStatusBadge(pipeline.status)}
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#333355] px-4 py-2 text-sm font-medium text-[#e4e4f0] hover:bg-[#1a1a2e]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => startEditing("form")}
                className="inline-flex items-center gap-2 rounded-lg border border-[#333355] px-4 py-2 text-sm font-medium text-[#e4e4f0] hover:bg-[#1a1a2e]"
              >
                Edit
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-400/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stages */}
      <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[#e4e4f0]">
          Pipeline Stages
        </h2>

        {isEditing ? (
          <div className="space-y-4">
            {/* JSON toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditJsonText(JSON.stringify({ stages: editStages }, null, 2))}
                className="text-xs text-[#8888a0] hover:text-primary underline"
              >
                Edit as JSON
              </button>
            </div>

            {/* JSON text editor */}
            {editJsonText && (
              <div className="space-y-2">
                <textarea
                  value={editJsonText}
                  onChange={(e) => {
                    setEditJsonText(e.target.value);
                    setJsonError(null);
                  }}
                  className="w-full h-64 rounded-lg border border-[#333355] bg-[#0a0a0f] p-3 font-mono text-xs text-[#e4e4f0] focus:outline-none focus:border-primary"
                  placeholder='{ "stages": [...] }'
                />
                {jsonError && <p className="text-xs text-red-400">{jsonError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleJsonEdit}
                    className="rounded-lg border border-[#333355] px-3 py-1 text-xs text-[#e4e4f0] hover:bg-[#1a1a2e]"
                  >
                    Parse JSON
                  </button>
                  <button
                    onClick={() => setEditJsonText("")}
                    className="rounded-lg px-3 py-1 text-xs text-[#8888a0] hover:text-[#e4e4f0]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Stage list (form view) */}
            {editStages.map((stage, index) => (
              <div
                key={stage.id}
                className={`rounded-lg border p-4 ${getStageTypeColor(stage.type)}`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 text-[#666680]">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={stage.name}
                        onChange={(e) => updateStage(index, { name: e.target.value })}
                        className="flex-1 rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-sm text-[#e4e4f0] focus:outline-none focus:border-primary"
                        placeholder="Stage name"
                      />
                      <select
                        value={stage.type}
                        onChange={(e) => updateStage(index, { type: e.target.value as Stage["type"] })}
                        className="rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-sm text-[#e4e4f0] focus:outline-none focus:border-primary"
                      >
                        <option value="script">Script</option>
                        <option value="checkpoint">Approval Gate</option>
                        <option value="deploy">Deploy</option>
                      </select>
                      <button
                        onClick={() => removeStage(index)}
                        className="rounded p-1.5 text-[#666680] hover:bg-red-400/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {stage.type !== "checkpoint" && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={stage.command || ""}
                          onChange={(e) => updateStage(index, { command: e.target.value })}
                          className="flex-1 rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 font-mono text-xs text-[#e4e4f0] focus:outline-none focus:border-primary"
                          placeholder="Command (e.g. npm ci && npm run build)"
                        />
                        <input
                          type="text"
                          value={stage.image || ""}
                          onChange={(e) => updateStage(index, { image: e.target.value })}
                          className="w-32 rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 font-mono text-xs text-[#e4e4f0] focus:outline-none focus:border-primary"
                          placeholder="Image (node:20)"
                        />
                      </div>
                    )}
                    {stage.type === "deploy" && (
                      <input
                        type="text"
                        value={stage.environment || ""}
                        onChange={(e) => updateStage(index, { environment: e.target.value })}
                        className="w-full rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-xs text-[#e4e4f0] focus:outline-none focus:border-primary"
                        placeholder="Environment (staging, production)"
                      />
                    )}
                    {stage.type === "checkpoint" && (
                      <input
                        type="text"
                        value={stage.message || ""}
                        onChange={(e) => updateStage(index, { message: e.target.value })}
                        className="w-full rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-xs text-[#e4e4f0] focus:outline-none focus:border-primary"
                        placeholder="Approval message (e.g. Please verify staging looks good)"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addStage}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[#333355] px-4 py-3 text-sm text-[#8888a0] hover:border-primary hover:text-primary w-full justify-center"
            >
              <Plus className="h-4 w-4" />
              Add Stage
            </button>
          </div>
        ) : (
          /* Read-only stage view */
          <div className="space-y-3">
            {stages.length === 0 ? (
              <p className="text-sm text-[#666680] text-center py-6">
                No stages defined. Click Edit to add stages.
              </p>
            ) : (
              stages.map((stage: Stage, index: number) => (
                <div
                  key={stage.id}
                  className={`rounded-lg border p-4 ${getStageTypeColor(stage.type)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#1a1a2e] text-xs font-medium text-[#8888a0]">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-[#e4e4f0]">{stage.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          stage.type === "checkpoint"
                            ? "bg-amber-400/10 text-amber-400"
                            : stage.type === "deploy"
                              ? "bg-blue-400/10 text-blue-400"
                              : "bg-[#1a1a2e] text-[#8888a0]"
                        }`}>
                          {getStageTypeLabel(stage.type)}
                        </span>
                      </div>
                      {stage.command && (
                        <code className="mt-1 block text-xs text-[#8888a0] font-mono truncate">
                          {stage.command}
                        </code>
                      )}
                      {stage.image && (
                        <span className="mt-1 inline-block text-xs text-[#666680]">
                          Image: {stage.image}
                        </span>
                      )}
                      {stage.environment && (
                        <span className="mt-1 inline-block text-xs text-[#666680]">
                          Env: {stage.environment}
                        </span>
                      )}
                      {stage.message && (
                        <p className="mt-1 text-xs text-[#8888a0] italic">{stage.message}</p>
                      )}
                    </div>
                    {index < stages.length - 1 && (
                      <div className="flex items-center text-[#333355]">
                        <ChevronRight className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Raw Config (read-only) */}
      {!isEditing && stages.length > 0 && (
        <div className="mt-6 rounded-xl border border-[#252540] bg-[#131320] p-6">
          <h3 className="mb-3 text-sm font-semibold text-[#8888a0]">Raw Config</h3>
          <pre className="overflow-x-auto rounded-lg bg-[#0a0a0f] p-4 font-mono text-xs text-[#8888a0]">
            {JSON.stringify({ stages }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
