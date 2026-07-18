import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Circle,
  MinusCircle,
  Play,
  AlertTriangle,
  StopCircle,
  SkipForward,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

interface StageRun {
  id: string;
  pipelineRunId: string;
  stageConfig: {
    id: string;
    name: string;
    type: "script" | "checkpoint" | "deploy";
    command?: string;
    image?: string;
    environment?: string;
    approvers?: string[];
    message?: string;
    order: number;
  };
  order: number;
  status: string;
  logOutput: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

interface PipelineRun {
  id: string;
  pipelineId: string;
  repositoryId: string;
  commitSha: string;
  branch: string;
  commitMessage: string | null;
  trigger: string;
  triggeredBy: string;
  status: string;
  currentStageOrder: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  stages: StageRun[];
  checkpointApprovals: any[];
  deployments: any[];
}

export default function RunDetail() {
  const { pipelineId, runId } = useParams<{ pipelineId: string; runId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const teamId = user?.teams?.[0]?.teamId;
  const queryClient = useQueryClient();
  const [approveComment, setApproveComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const toggleLog = (stageId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  const isActive = (status: string) =>
    status === "running" || status === "awaiting_approval" || status === "pending";

  const { data, isLoading, error } = useQuery({
    queryKey: ["run", teamId, pipelineId, runId],
    queryFn: () => api.getRun(teamId!, pipelineId!, runId!),
    enabled: !!teamId && !!pipelineId && !!runId,
    refetchInterval: (query) => {
      const run = query.state.data?.run as PipelineRun | undefined;
      return run && isActive(run.status) ? 3000 : false;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelRun(teamId!, pipelineId!, runId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["run", teamId, pipelineId, runId] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => api.approveCheckpoint(teamId!, pipelineId!, runId!, approveComment || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["run", teamId, pipelineId, runId] });
      setShowApprove(false);
      setApproveComment("");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.rejectCheckpoint(teamId!, pipelineId!, runId!, rejectComment || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["run", teamId, pipelineId, runId] });
      setShowReject(false);
      setRejectComment("");
    },
  });

  const run: PipelineRun | undefined = data?.run;

  const getStatusIcon = (status: string, size = "default") => {
    const cls = size === "lg" ? "h-6 w-6" : "h-4 w-4";
    switch (status) {
      case "running":
        return <Loader2 className={`${cls} text-blue-400 animate-spin`} />;
      case "success":
      case "passed":
      case "approved":
        return <CheckCircle2 className={`${cls} text-emerald-400`} />;
      case "failed":
      case "rejected":
        return <XCircle className={`${cls} text-red-400`} />;
      case "awaiting_approval":
        return <Clock className={`${cls} text-amber-400 animate-pulse`} />;
      case "cancelled":
        return <StopCircle className={`${cls} text-[#666680]`} />;
      case "skipped":
        return <MinusCircle className={`${cls} text-[#666680]`} />;
      case "pending":
      default:
        return <Circle className={`${cls} text-[#666680]`} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "border-blue-400/20 bg-blue-400/10 text-blue-400";
      case "success":
      case "passed":
        return "border-emerald-400/20 bg-emerald-400/10 text-emerald-400";
      case "failed":
      case "rejected":
        return "border-red-400/20 bg-red-400/10 text-red-400";
      case "awaiting_approval":
        return "border-amber-400/20 bg-amber-400/10 text-amber-400";
      case "cancelled":
        return "border-[#333355]/50 bg-[#1a1a2e] text-[#8888a0]";
      default:
        return "border-[#333355]/50 bg-[#1a1a2e] text-[#8888a0]";
    }
  };

  const getStageTypeLabel = (type: string) => {
    switch (type) {
      case "script": return "Script";
      case "checkpoint": return "Approval Gate";
      case "deploy": return "Deploy";
      default: return type;
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (started: string | null, finished: string | null) => {
    if (!started) return "—";
    const end = finished ? new Date(finished).getTime() : Date.now();
    const start = new Date(started).getTime();
    const ms = end - start;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        {/* Back nav skeleton */}
        <div className="mb-6 h-4 w-32 animate-pulse rounded bg-[#1a1a2e]" />

        {/* Header skeleton */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-40 animate-pulse rounded bg-[#1a1a2e]" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-[#1a1a2e]" />
              </div>
              <div className="h-4 w-64 animate-pulse rounded bg-[#1a1a2e]" />
              <div className="h-3 w-48 animate-pulse rounded bg-[#1a1a2e]" />
            </div>
            <div className="h-9 w-28 animate-pulse rounded-lg bg-[#1a1a2e]" />
          </div>
        </div>

        {/* Stage timeline skeleton */}
        <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
          <div className="mb-6 h-6 w-36 animate-pulse rounded bg-[#1a1a2e]" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-[#1a1a2e]" />
                <div className="flex-1 rounded-lg border border-[#252540] bg-[#1a1a2e] p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-32 animate-pulse rounded bg-[#252540]" />
                        <div className="h-4 w-16 animate-pulse rounded-full bg-[#252540]" />
                      </div>
                      <div className="h-3 w-48 animate-pulse rounded bg-[#252540]" />
                    </div>
                    <div className="h-3 w-12 animate-pulse rounded bg-[#252540]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error / not found ──
  if (error || !run) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-6 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-400/60 mb-3" />
          <p className="text-red-400 font-medium">Run not found</p>
          <p className="mt-1 text-sm text-[#8888a0]">
            The pipeline run you're looking for doesn't exist or you don't have access to it.
          </p>
          <Link
            to={`/pipelines/${pipelineId}`}
            className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Pipeline
          </Link>
        </div>
      </div>
    );
  }

  const stages: StageRun[] = run.stages || [];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back navigation */}
      <Link
        to={`/pipelines/${pipelineId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#8888a0] hover:text-[#e4e4f0] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pipeline
      </Link>

      {/* Run Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#e4e4f0]">
                Run {run.id.substring(0, 8)}
              </h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(run.status)}`}>
                {getStatusIcon(run.status)}
                {run.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm text-[#8888a0]">
              <span>Branch: {run.branch}</span>
              <span>•</span>
              <span className="font-mono">SHA: {run.commitSha.substring(0, 7)}</span>
              {run.commitMessage && (
                <>
                  <span>•</span>
                  <span className="max-w-xs truncate">{run.commitMessage}</span>
                </>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-[#666680]">
              <span>Started: {formatTime(run.startedAt)}</span>
              <span>•</span>
              <span>Duration: {formatDuration(run.startedAt, run.finishedAt)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {isActive(run.status) && (
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-400/10 disabled:opacity-50"
              >
                <StopCircle className="h-4 w-4" />
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Run"}
              </button>
            )}
          </div>
        </div>

        {/* Checkpoint action bar */}
        {run.status === "awaiting_approval" && (
          <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-400">Approval Required</p>
                  <p className="text-xs text-[#8888a0] mt-0.5">
                    This pipeline is waiting for checkpoint approval before continuing.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowApprove(true); setShowReject(false); }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-400/20 transition-colors"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  onClick={() => { setShowReject(true); setShowApprove(false); }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-400/10 border border-red-400/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/20 transition-colors"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            </div>

            {showApprove && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  placeholder="Add a comment (optional)"
                  className="flex-1 rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-xs text-[#e4e4f0] focus:outline-none focus:border-emerald-400"
                />
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="rounded-lg bg-emerald-400/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-400/30 disabled:opacity-50"
                >
                  {approveMutation.isPending ? "..." : "Confirm"}
                </button>
              </div>
            )}

            {showReject && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Reason for rejection (optional)"
                  className="flex-1 rounded-md border border-[#333355] bg-[#0a0a0f] px-3 py-1.5 text-xs text-[#e4e4f0] focus:outline-none focus:border-red-400"
                />
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                  className="rounded-lg bg-red-400/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/30 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? "..." : "Confirm"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stage Timeline */}
      <div className="rounded-xl border border-[#252540] bg-[#131320] bg-mesh p-6">
        <h2 className="mb-6 text-lg font-semibold text-[#e4e4f0]">Stage Timeline</h2>

        {stages.length === 0 ? (
          <div className="text-center py-8">
            <Circle className="mx-auto h-10 w-10 text-[#666680]/50 mb-3" />
            <p className="text-sm text-[#666680]">No stages found for this run.</p>
            <p className="mt-1 text-xs text-[#666680]/60">
              Stages will appear here once the pipeline begins execution.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[#252540]" />

            <div className="space-y-0">
              {stages.map((stage, index) => {
                const isLast = index === stages.length - 1;
                const isCurrent = stage.order === run.currentStageOrder;
                const isLogExpanded = expandedLogs.has(stage.id);
                const hasLog = !!stage.logOutput;

                return (
                  <div key={stage.id} className="relative pb-4 last:pb-0">
                    <div className="flex gap-4">
                      {/* Timeline node */}
                      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#252540] bg-[#131320]">
                        {getStatusIcon(stage.status)}
                      </div>

                      {/* Stage card */}
                      <div
                        className={`flex-1 rounded-lg border card-lift p-4 ${
                          isCurrent && isActive(stage.status)
                            ? "border-primary/30 bg-primary/5"
                            : "border-[#252540] bg-[#1a1a2e]"
                        } ${hasLog ? "cursor-pointer" : ""}`}
                        onClick={() => hasLog && toggleLog(stage.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${
                                stage.status === "running" ? "text-blue-400" :
                                stage.status === "success" || stage.status === "passed" ? "text-emerald-400" :
                                stage.status === "failed" ? "text-red-400" :
                                "text-[#e4e4f0]"
                              }`}>
                                {stage.stageConfig.name}
                              </span>
                              <span className="rounded-full bg-[#252540] px-1.5 py-0.5 text-[10px] font-medium text-[#8888a0] uppercase">
                                {getStageTypeLabel(stage.stageConfig.type)}
                              </span>
                              {hasLog && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-[#666680]">
                                  {isLogExpanded ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                  Logs
                                </span>
                              )}
                            </div>

                            {stage.stageConfig.type === "script" && stage.stageConfig.command && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <Terminal className="h-3 w-3 text-[#666680]" />
                                <code className="text-xs text-[#8888a0] font-mono">
                                  {stage.stageConfig.command}
                                </code>
                              </div>
                            )}

                            {stage.stageConfig.type === "checkpoint" && stage.stageConfig.message && (
                              <p className="mt-1 text-xs text-amber-400/70">
                                {stage.stageConfig.message}
                              </p>
                            )}

                            {stage.stageConfig.type === "deploy" && stage.stageConfig.environment && (
                              <p className="mt-1 text-xs text-blue-400/70">
                                Environment: {stage.stageConfig.environment}
                              </p>
                            )}
                          </div>

                          <div className="text-right text-xs text-[#666680]">
                            {stage.startedAt && <p>{formatDuration(stage.startedAt, stage.finishedAt)}</p>}
                          </div>
                        </div>

                        {/* Collapsible log output */}
                        {hasLog && isLogExpanded && (
                          <div
                            className="mt-3 rounded-md bg-[#0a0a0f] border border-[#252540] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between border-b border-[#252540] px-3 py-1.5">
                              <span className="text-[10px] font-medium text-[#666680] uppercase tracking-wider">
                                Log Output
                              </span>
                              <button
                                onClick={() => toggleLog(stage.id)}
                                className="text-[10px] text-[#666680] hover:text-[#8888a0] transition-colors"
                              >
                                Hide
                              </button>
                            </div>
                            <pre className="p-3 font-mono text-xs text-[#a0a0b8] max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                              {stage.logOutput}
                            </pre>
                          </div>
                        )}

                        {/* Checkpoint approval status */}
                        {stage.stageConfig.type === "checkpoint" && stage.status === "awaiting_approval" && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Waiting for approval from designated reviewers
                          </div>
                        )}

                        {stage.stageConfig.type === "checkpoint" && (stage.status === "success" || stage.status === "passed") && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Checkpoint approved
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Deployments */}
      {run.deployments && run.deployments.length > 0 && (
        <div className="mt-6 rounded-xl border border-[#252540] bg-[#131320] bg-mesh p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#e4e4f0]">Deployments</h2>
          <div className="space-y-2">
            {run.deployments.map((deploy: any) => (
              <div key={deploy.id} className="flex items-center justify-between rounded-lg border border-[#252540] bg-[#1a1a2e] card-lift p-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-[#e4e4f0]">
                      {deploy.environment}
                    </p>
                    <p className="text-xs text-[#666680]">
                      {formatTime(deploy.deployedAt)}
                    </p>
                  </div>
                </div>
                {deploy.deployUrl && (
                  <a
                    href={deploy.deployUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
