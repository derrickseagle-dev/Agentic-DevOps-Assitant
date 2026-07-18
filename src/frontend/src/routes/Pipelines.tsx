import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Plus, GitBranch, Trash2, ExternalLink, Play } from "lucide-react";
import { useState } from "react";

export default function Pipelines() {
  const { user } = useAuth();
  const teamId = user?.teams?.[0]?.teamId;
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pipelines", teamId],
    queryFn: () => api.listPipelines(teamId!),
    enabled: !!teamId,
  });

  const deleteMutation = useMutation({
    mutationFn: (pipelineId: string) => api.deletePipeline(teamId!, pipelineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines", teamId] });
      setDeleteConfirm(null);
    },
  });

  const pipelines = data?.pipelines ?? [];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
      paused: "bg-amber-400/10 text-amber-400 border-amber-400/20",
      draft: "bg-[#333355]/50 text-[#8888a0] border-[#333355]",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] || styles.draft}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e4e4f0]">Pipelines</h1>
          <p className="mt-1 text-sm text-[#8888a0]">
            Manage your CI/CD pipeline configurations
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/repositories"
            className="inline-flex items-center gap-2 rounded-lg border border-[#252540] bg-[#1a1a2e] px-4 py-2 text-sm font-medium text-[#e4e4f0] hover:bg-[#252540] transition-colors"
          >
            <GitBranch className="h-4 w-4" />
            Connect Repo
          </Link>
          <Link
            to="/pipelines/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Pipeline
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#131320]" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-6 text-center">
          <p className="text-red-400">Failed to load pipelines. Please try again.</p>
        </div>
      ) : pipelines.length === 0 ? (
        <div className="rounded-xl border border-[#252540] bg-[#131320]">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <GitBranch className="mb-4 h-12 w-12 text-[#333355]" />
            <h2 className="text-lg font-semibold text-[#8888a0]">No pipelines yet</h2>
            <p className="mt-2 max-w-md text-sm text-[#666680]">
              Connect a repository and create your first CI/CD pipeline.
              Start with a repository connection, then define your pipeline stages.
            </p>
            <div className="mt-6 flex gap-3">
              <Link
                to="/repositories"
                className="inline-flex items-center gap-2 rounded-lg border border-[#333355] px-4 py-2 text-sm font-medium text-[#e4e4f0] hover:bg-[#1a1a2e] transition-colors"
              >
                <GitBranch className="h-4 w-4" />
                Connect Repository
              </Link>
              <Link
                to="/pipelines/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Pipeline
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p: any) => (
            <div
              key={p.id}
              className="group rounded-xl border border-[#252540] bg-[#131320] p-5 transition-colors hover:border-[#333355]"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/pipelines/${p.id}`}
                    className="text-lg font-semibold text-[#e4e4f0] hover:text-primary transition-colors"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-1 flex items-center gap-3 text-sm text-[#8888a0]">
                    <span className="inline-flex items-center gap-1">
                      <GitBranch className="h-3.5 w-3.5" />
                      {p.repoFullName || p.repoName || "Unknown repo"}
                    </span>
                    <span>•</span>
                    <span>Trigger: {p.triggerMode}</span>
                  </div>
                  {p.config?.stages && (
                    <div className="mt-3 flex items-center gap-1.5">
                      {p.config.stages.map((stage: any) => (
                        <span
                          key={stage.id}
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                            stage.type === "checkpoint"
                              ? "border-amber-400/20 bg-amber-400/5 text-amber-400"
                              : stage.type === "deploy"
                                ? "border-blue-400/20 bg-blue-400/5 text-blue-400"
                                : "border-[#333355] bg-[#1a1a2e] text-[#8888a0]"
                          }`}
                        >
                          {stage.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {getStatusBadge(p.status)}
                  <button
                    onClick={() => setDeleteConfirm(p.id)}
                    className="rounded-lg p-2 text-[#666680] opacity-0 transition-all hover:bg-red-400/10 hover:text-red-400 group-hover:opacity-100"
                    title="Delete pipeline"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-[#252540] bg-[#131320] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#e4e4f0]">Delete Pipeline</h3>
            <p className="mt-2 text-sm text-[#8888a0]">
              Are you sure you want to delete this pipeline? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-[#333355] px-4 py-2 text-sm font-medium text-[#e4e4f0] hover:bg-[#1a1a2e]"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
