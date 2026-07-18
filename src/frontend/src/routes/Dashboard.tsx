import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import {
  Activity,
  PlayCircle,
  Clock,
  CheckCircle2,
  Rocket,
  XCircle,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";

// ── Relative time helper ──
function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + (dateStr.endsWith("Z") ? "" : "Z"));
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

// ── Run status icon + color ──
function RunStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-400" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    case "pending":
      return <Clock className="h-4 w-4 text-gray-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

// ── Deployment status icon ──
function DeployStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-400" />;
    case "running":
    case "in_progress":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

// ── Skeleton for a feed item ──
function FeedItemSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="h-8 w-8 rounded-lg bg-[#1a1a2e]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-3/4 rounded bg-[#1a1a2e]" />
        <div className="h-2.5 w-1/3 rounded bg-[#1a1a2e]" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const teamId = user?.teams?.[0]?.teamId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", teamId],
    queryFn: () => api.getDashboard(teamId!),
    enabled: !!teamId,
  });

  const {
    data: activityData,
    isLoading: isActivityLoading,
    error: activityError,
  } = useQuery({
    queryKey: ["dashboard-activity", teamId],
    queryFn: () => api.getDashboardActivity(teamId!),
    enabled: !!teamId,
  });

  const stats = [
    {
      label: "Active Pipelines",
      value: data?.activePipelines ?? "-",
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Runs (7 days)",
      value: data?.recentRuns ?? "-",
      icon: PlayCircle,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "Pending Approvals",
      value: data?.pendingApprovals ?? "-",
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Success Rate",
      value: data ? `${data.deploymentSuccessRate}%` : "-",
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Deployments (30d)",
      value: data?.deploymentFrequency ?? "-",
      icon: Rocket,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
  ];

  const recentRuns = activityData?.recentRuns ?? [];
  const recentDeployments = activityData?.recentDeployments ?? [];

  return (
    <div className="mx-auto max-w-6xl bg-mesh bg-dots">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e4e4f0]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#8888a0]">
          Overview of your team's CI/CD pipelines
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load dashboard data. Please try again.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="card-lift rounded-xl border border-[#252540] bg-[#131320] p-5"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg ${stat.bg} p-2`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#8888a0]">{stat.label}</p>
                  <p className="text-2xl font-bold text-[#e4e4f0]">
                    {isLoading ? (
                      <span className="inline-block h-7 w-12 animate-pulse rounded bg-[#1a1a2e]" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Activity Feeds ── */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent Runs */}
        <div className="card-lift rounded-xl border border-[#252540] bg-[#131320] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#e4e4f0]">Recent Runs</h2>
            <Link
              to="/pipelines"
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          </div>

          {activityError ? (
            <p className="text-sm text-red-400">Failed to load runs.</p>
          ) : isActivityLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <FeedItemSkeleton key={i} />
              ))}
            </div>
          ) : recentRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PlayCircle className="mb-3 h-10 w-10 text-[#252540]" />
              <p className="text-sm text-[#8888a0]">
                No runs yet. Trigger your first pipeline run!
              </p>
              <Link
                to="/pipelines"
                className="mt-2 text-sm text-primary hover:underline"
              >
                Go to pipelines →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run: any) => (
                <Link
                  key={run.id}
                  to={`/pipelines/${run.pipelineId}/runs/${run.id}`}
                  className="flex items-center gap-3 rounded-lg bg-[#1a1a2e] p-3 transition-colors hover:bg-[#222240]"
                >
                  <RunStatusIcon status={run.status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#e4e4f0]">
                      {run.pipelineName}
                      <span className="ml-1.5 text-xs text-[#8888a0]">
                        · {run.branch}
                      </span>
                    </p>
                    {run.commitMessage && (
                      <p className="truncate text-xs text-[#666680]">
                        {run.commitMessage}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-[#8888a0]">
                    {timeAgo(run.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Deployments */}
        <div className="card-lift rounded-xl border border-[#252540] bg-[#131320] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#e4e4f0]">
              Recent Deployments
            </h2>
            <Link
              to="/pipelines"
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          </div>

          {activityError ? (
            <p className="text-sm text-red-400">Failed to load deployments.</p>
          ) : isActivityLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <FeedItemSkeleton key={i} />
              ))}
            </div>
          ) : recentDeployments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Rocket className="mb-3 h-10 w-10 text-[#252540]" />
              <p className="text-sm text-[#8888a0]">
                No deployments yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDeployments.map((deploy: any) => (
                <div
                  key={deploy.id}
                  className="flex items-center gap-3 rounded-lg bg-[#1a1a2e] p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-400/10">
                    <Rocket className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#e4e4f0]">
                      <span className="text-xs font-normal text-purple-400">
                        {deploy.environment}
                      </span>
                      <span className="mx-1.5 text-[#8888a0]">·</span>
                      {deploy.repositoryName}
                    </p>
                    <p className="text-xs text-[#666680]">
                      {deploy.repositoryFullName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <DeployStatusIcon status={deploy.status} />
                    <span className="text-xs text-[#8888a0]">
                      {deploy.deployedAt ? timeAgo(deploy.deployedAt) : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
