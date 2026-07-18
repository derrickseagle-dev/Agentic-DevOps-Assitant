import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Activity, GitBranch, CheckCircle, ArrowRight, Plus, Lock, Globe } from "lucide-react";

type Step = 1 | 2 | 3;

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Create team mutation
  const createTeam = useMutation({
    mutationFn: (data: { name: string; slug: string }) => api.createTeam(data),
    onSuccess: (data) => {
      setCreatedTeamId(data.team?.id || data.id);
      setTeamError(null);
      refresh();
      setStep(2);
    },
    onError: (err: any) => {
      setTeamError(err.message || "Failed to create team");
    },
  });

  // Available repos from GitHub
  const { data: availableRepos, isLoading: loadingRepos } = useQuery({
    queryKey: ["repositories-available", createdTeamId],
    queryFn: () => api.listAvailableRepos(createdTeamId!),
    enabled: !!createdTeamId && step === 2,
  });

  // Connect repo mutation
  const connectRepo = useMutation({
    mutationFn: (repo: any) =>
      api.connectRepository(createdTeamId!, {
        githubRepoId: repo.githubRepoId,
        name: repo.name,
        fullName: repo.fullName,
        url: repo.url,
        isPrivate: repo.isPrivate,
        defaultBranch: repo.defaultBranch,
        language: repo.language,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories", createdTeamId] });
      setConnectError(null);
      setStep(3);
    },
    onError: (err: any) => {
      setConnectError(err.message || "Failed to connect repository");
    },
  });

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setTeamError("Team name is required");
      return;
    }
    const slug = teamSlug.trim() || teamName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    createTeam.mutate({ name: teamName.trim(), slug });
  };

  const handleConnectRepo = (repo: any) => {
    connectRepo.mutate(repo);
  };

  const handleSkipRepo = () => {
    setStep(3);
  };

  const handleGoToApp = () => {
    refresh();
    navigate("/");
  };

  const steps = [
    { num: 1, label: "Create Team", active: step >= 1, done: step > 1 },
    { num: 2, label: "Connect Repo", active: step >= 2, done: step > 2 },
    { num: 3, label: "All Set!", active: step >= 3, done: step > 3 },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Activity className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-[#e4e4f0]">Welcome to PipelineForge</h1>
          <p className="mt-2 text-sm text-[#8888a0]">
            Let&apos;s get you set up in under 2 minutes
          </p>
        </div>

        {/* Step indicators */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  s.done
                    ? "bg-green-500/20 text-green-400"
                    : s.active
                      ? "bg-primary text-white"
                      : "bg-[#1c1c30] text-[#666680]"
                }`}
              >
                {s.done ? <CheckCircle className="h-4 w-4" /> : s.num}
              </div>
              <span
                className={`text-xs ${
                  s.active ? "text-[#c4c4d0]" : "text-[#666680]"
                }`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className={`mx-1 h-px w-8 ${s.done ? "bg-green-500/40" : "bg-[#252540]"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Create Team */}
        {step === 1 && (
          <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
            <h2 className="text-lg font-semibold text-[#e4e4f0]">Create your team</h2>
            <p className="mt-1 text-sm text-[#8888a0]">
              Your team is where you&apos;ll manage pipelines and collaborate with others.
            </p>
            <form onSubmit={handleCreateTeam} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#c4c4d0] mb-1.5">
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Acme Engineering"
                  className="w-full rounded-lg border border-[#333355] bg-[#0a0a0f] px-3 py-2.5 text-sm text-[#e4e4f0] placeholder-[#555570] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#c4c4d0] mb-1.5">
                  Slug{" "}
                  <span className="text-[#666680] font-normal">(URL-friendly name)</span>
                </label>
                <input
                  type="text"
                  value={teamSlug}
                  onChange={(e) => setTeamSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))}
                  placeholder="acme-engineering"
                  className="w-full rounded-lg border border-[#333355] bg-[#0a0a0f] px-3 py-2.5 text-sm text-[#e4e4f0] placeholder-[#555570] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {teamError && (
                <p className="text-sm text-red-400">{teamError}</p>
              )}
              <button
                type="submit"
                disabled={createTeam.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {createTeam.isPending ? "Creating..." : "Create Team"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Connect Repo */}
        {step === 2 && (
          <div className="rounded-xl border border-[#252540] bg-[#131320] p-6">
            <h2 className="text-lg font-semibold text-[#e4e4f0]">Connect a repository</h2>
            <p className="mt-1 text-sm text-[#8888a0]">
              Choose a GitHub repo to start building your first pipeline.
            </p>

            {loadingRepos ? (
              <div className="mt-6 flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="mt-4 max-h-80 space-y-1 overflow-y-auto">
                {(availableRepos?.repositories ?? []).map((repo: any) => (
                  <button
                    key={repo.githubRepoId}
                    onClick={() => handleConnectRepo(repo)}
                    disabled={connectRepo.isPending}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#1c1c30] disabled:opacity-50"
                  >
                    <GitBranch className="h-4 w-4 flex-shrink-0 text-[#8888a0]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#e4e4f0]">
                        {repo.fullName}
                      </p>
                      {repo.language && (
                        <p className="text-xs text-[#666680]">{repo.language}</p>
                      )}
                    </div>
                    {repo.isPrivate ? (
                      <Lock className="h-3.5 w-3.5 text-[#666680]" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-[#666680]" />
                    )}
                    <Plus className="h-4 w-4 text-primary" />
                  </button>
                ))}
                {(!availableRepos?.repositories || availableRepos.repositories.length === 0) && (
                  <p className="py-8 text-center text-sm text-[#666680]">
                    No repositories found. Make sure your GitHub account has repos.
                  </p>
                )}
              </div>
            )}
            {connectError && (
              <p className="mt-2 text-sm text-red-400">{connectError}</p>
            )}
            <button
              onClick={handleSkipRepo}
              className="mt-4 w-full rounded-lg border border-[#333355] px-4 py-2.5 text-sm text-[#8888a0] transition-colors hover:bg-[#1c1c30]"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="rounded-xl border border-[#252540] bg-[#131320] p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-[#e4e4f0]">You&apos;re all set!</h2>
            <p className="mt-2 text-sm text-[#8888a0]">
              Your team is created and you&apos;re ready to start building pipelines.
              Head to the dashboard to generate your first pipeline.
            </p>
            <button
              onClick={handleGoToApp}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
