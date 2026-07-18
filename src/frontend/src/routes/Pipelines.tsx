import { GitBranch, Plus } from "lucide-react";

export default function Pipelines() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e4e4f0]">Pipelines</h1>
          <p className="mt-1 text-sm text-[#8888a0]">
            Manage your CI/CD pipeline configurations
          </p>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-2 rounded-lg bg-primary/20 px-4 py-2 text-sm font-medium text-primary/50 cursor-not-allowed"
          title="Coming in M2"
        >
          <Plus className="h-4 w-4" />
          New Pipeline
        </button>
      </div>

      <div className="rounded-xl border border-[#252540] bg-[#131320]">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GitBranch className="mb-4 h-12 w-12 text-[#333355]" />
          <h2 className="text-lg font-semibold text-[#8888a0]">No pipelines yet</h2>
          <p className="mt-2 max-w-md text-sm text-[#666680]">
            Pipeline creation and repository connection will be available in Milestone 2.
            Stay tuned for AI-powered pipeline generation.
          </p>
        </div>
      </div>
    </div>
  );
}
