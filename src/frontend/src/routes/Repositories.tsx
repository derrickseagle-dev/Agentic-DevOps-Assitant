import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { GitBranch, Plus, Trash2, ExternalLink, Lock, Globe, RefreshCw, Search } from "lucide-react";
import { useState } from "react";

export default function Repositories() {
  const { user } = useAuth();
  const teamId = user?.teams?.[0]?.teamId;
  const queryClient = useQueryClient();
  const [showConnect, setShowConnect] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);

  // Connected repos
  const { data: connected, isLoading: loadingConnected } = useQuery({
    queryKey: ["repositories", teamId],
    queryFn: () => api.listRepositories(teamId!),
    enabled: !!teamId,
  });

  // Available repos from GitHub
  const { data: available, isLoading: loadingAvailable, refetch: refetchAvailable } = useQuery({
    queryKey: ["repositories-available", teamId],
    queryFn: () => api.listAvailableRepos(teamId!),
    enabled: !!teamId && showConnect,
  });

  const connectMutation = useMutation({
    mutationFn: (repo: any) =>
      api.connectRepository(teamId!, {
        githubRepoId: repo.githubRepoId,
        name: repo.name,
        fullName: repo.fullName,
        url: repo.url,
        isPrivate: repo.isPrivate,
        defaultBranch: repo.defaultBranch,
        language: repo.language,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories", teamId] });
      setConnectError(null);
    },
    onError: (err: any) => {
      setConnectError(err.message || "Failed to connect repository");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (repoId: string) => api.disconnectRepository(teamId!, repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories", teamId] });
    },
  });

  const connectedRepos = connected?.repositories ?? [];
  const availableRepos = available?.repositories ?? [];
  const connectedIds = new Set(connectedRepos.map((r: any) => r.githubRepoId));

  const filteredAvailable = searchQuery
    ? availableRepos.filter(
        (r: any) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.fullName.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : availableRepos;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e4e4f0]">Repositories</h1>
          <p className="mt-1 text-sm text-[#8888a0]">
            Connect GitHub repositories to use with your pipelines
          </p>
        </div>
        <button
          onClick={() => setShowConnect(!showConnect)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {showConnect ? "Close" : "Connect Repository"}
        </button>
      </div>

      {/* Connected repositories */}
      {loadingConnected ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#131320]" />
          ))}
        </div>
      ) : connectedRepos.length === 0 ? (
        <div className="rounded-xl border border-[#252540] bg-[#131320]">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GitBranch className="mb-4 h-12 w-12 text-[#333355]" />
            <h2 className="text-lg font-semibold text-[#8888a0]">No repositories connected</h2>
            <p className="mt-2 max-w-md text-sm text-[#666680]">
              Connect a GitHub repository to start building pipelines. You'll be able to
              browse your GitHub repositories and select the ones you want to use.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {connectedRepos.map((repo: any) => (
            <div
              key={repo.id}
              className="flex items-center justify-between rounded-xl border border-[#252540] bg-[#131320] p-5"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1a1a2e]">
                  <GitBranch className="h-5 w-5 text-[#8888a0]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-[#e4e4f0]">{repo.name}</h3>
                    <span className="text-sm text-[#666680]">{repo.fullName}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-[#666680]">
                    <span>Default: {repo.defaultBranch}</span>
                    {repo.language && (
                      <>
                        <span>•</span>
                        <span>{repo.language}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Link
                  to={`/pipelines/new?repoId=${repo.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#333355] px-3 py-1.5 text-xs font-medium text-[#e4e4f0] hover:bg-[#1a1a2e] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Pipeline
                </Link>
                <button
                  onClick={() => disconnectMutation.mutate(repo.id)}
                  disabled={disconnectMutation.isPending}
                  className="rounded-lg p-2 text-[#666680] hover:bg-red-400/10 hover:text-red-400 transition-colors"
                  title="Disconnect"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connect new repository panel */}
      {showConnect && (
        <div className="mt-6 rounded-xl border border-[#252540] bg-[#131320] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#e4e4f0]">
              Connect a GitHub Repository
            </h2>
            <button
              onClick={() => refetchAvailable()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[#8888a0] hover:text-[#e4e4f0] hover:bg-[#1a1a2e] transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666680]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              className="w-full rounded-lg border border-[#333355] bg-[#0a0a0f] pl-10 pr-4 py-2 text-sm text-[#e4e4f0] placeholder:text-[#555570] focus:outline-none focus:border-primary"
            />
          </div>

          {connectError && (
            <div className="mb-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-400">
              {connectError}
            </div>
          )}

          {loadingAvailable ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-[#0a0a0f]" />
              ))}
            </div>
          ) : filteredAvailable.length === 0 ? (
            <p className="text-sm text-[#666680] text-center py-8">
              {searchQuery ? "No repositories match your search." : "No repositories available. Try refreshing."}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredAvailable.map((repo: any) => {
                const isConnected = connectedIds.has(repo.githubRepoId);
                return (
                  <div
                    key={repo.githubRepoId}
                    className="flex items-center justify-between rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] p-3 hover:border-[#333355] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {repo.isPrivate ? (
                        <Lock className="h-4 w-4 text-[#666680] shrink-0" />
                      ) : (
                        <Globe className="h-4 w-4 text-[#666680] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#e4e4f0] truncate">
                          {repo.fullName}
                        </p>
                        {repo.description && (
                          <p className="text-xs text-[#666680] truncate">{repo.description}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => connectMutation.mutate(repo)}
                      disabled={isConnected || connectMutation.isPending}
                      className={`ml-3 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        isConnected
                          ? "bg-emerald-400/10 text-emerald-400 cursor-default"
                          : "bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                      }`}
                    >
                      {isConnected ? "Connected" : connectMutation.isPending ? "Connecting..." : "Connect"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
