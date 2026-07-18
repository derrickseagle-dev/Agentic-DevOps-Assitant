import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Activity, PlayCircle, Clock, CheckCircle2, Rocket } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const teamId = user?.teams?.[0]?.teamId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", teamId],
    queryFn: () => api.getDashboard(teamId!),
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

  return (
    <div className="mx-auto max-w-6xl">
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

      {/* Quick links / recent activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card-lift rounded-xl border border-[#252540] bg-[#131320] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#e4e4f0]">Quick Overview</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-[#1a1a2e] p-3">
              <span className="text-sm text-[#8888a0]">Total pipelines</span>
              <span className="text-sm font-medium text-[#e4e4f0]">
                {isLoading ? "..." : data?.activePipelines ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1a1a2e] p-3">
              <span className="text-sm text-[#8888a0]">Pending approvals</span>
              <span className="text-sm font-medium text-[#e4e4f0]">
                {isLoading ? "..." : data?.pendingApprovals ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1a1a2e] p-3">
              <span className="text-sm text-[#8888a0]">Recent runs (7 days)</span>
              <span className="text-sm font-medium text-[#e4e4f0]">
                {isLoading ? "..." : data?.recentRuns ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1a1a2e] p-3">
              <span className="text-sm text-[#8888a0]">Deployments (30 days)</span>
              <span className="text-sm font-medium text-[#e4e4f0]">
                {isLoading ? "..." : data?.deploymentFrequency ?? 0}
              </span>
            </div>
          </div>
        </div>

        <div className="card-lift rounded-xl border border-[#252540] bg-[#131320] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#e4e4f0]">Getting Started</h2>
          <div className="space-y-3 text-sm text-[#8888a0]">
            <p>
              <span className="font-medium text-[#e4e4f0]">1.</span> Connect a GitHub
              repository from the{" "}
              <a href="/repositories" className="text-primary hover:underline">
                Repositories
              </a>{" "}
              page.
            </p>
            <p>
              <span className="font-medium text-[#e4e4f0]">2.</span> Create a pipeline
              or let AI generate one for you.
            </p>
            <p>
              <span className="font-medium text-[#e4e4f0]">3.</span> Trigger a run and
              watch your pipeline execute with human-in-the-loop checkpoints.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
