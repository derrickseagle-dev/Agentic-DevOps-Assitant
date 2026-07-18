import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Activity, GitBranch, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const teamId = user?.teams?.[0]?.teamId;

  const { data, isLoading } = useQuery({
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
      label: "Recent Runs",
      value: data?.recentRuns ?? "-",
      icon: GitBranch,
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
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e4e4f0]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#8888a0]">
          Overview of your team's CI/CD pipelines
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[#252540] bg-[#131320] p-5"
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

      {/* Placeholder sections for future milestones */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#e4e4f0]">Recent Runs</h2>
          <EmptyPlaceholder
            icon={GitBranch}
            title="No pipeline runs yet"
            description="Pipeline runs will appear here once you create and trigger your first pipeline."
          />
        </div>

        <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#e4e4f0]">Pending Actions</h2>
          <EmptyPlaceholder
            icon={AlertTriangle}
            title="No pending actions"
            description="Checkpoint approvals and deployment confirmations will appear here."
          />
        </div>
      </div>
    </div>
  );
}

function EmptyPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Icon className="mb-3 h-10 w-10 text-[#333355]" />
      <p className="text-sm font-medium text-[#8888a0]">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-[#666680]">{description}</p>
    </div>
  );
}
