import { useAuth } from "../hooks/useAuth";
import { Activity, Github, Zap, Shield, Rocket } from "lucide-react";

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] bg-dots bg-mesh">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Activity className="h-9 w-9 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-[#e4e4f0] tracking-tight">PipelineForge</h1>
          <p className="mt-2 text-sm text-[#8888a0]">
            AI-powered CI/CD automation for engineering teams
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-[#252540] bg-[#131320] p-6">
          <button
            onClick={login}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#24292e] px-4 py-3 text-sm font-medium text-white transition-all hover:bg-[#2c343a] hover:shadow-lg hover:shadow-black/20"
          >
            <Github className="h-5 w-5" />
            Sign in with GitHub
          </button>

          <p className="mt-4 text-center text-xs text-[#666680]">
            We only request read access to your GitHub profile.
            <br />
            Repository access is granted separately when connecting repos.
          </p>
        </div>

        {/* Feature pills */}
        <div className="mt-8 flex justify-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-[#252540] bg-[#131320] px-3 py-1.5 text-xs text-[#8888a0]">
            <Zap className="h-3 w-3 text-primary" />
            AI-Generated Pipelines
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-[#252540] bg-[#131320] px-3 py-1.5 text-xs text-[#8888a0]">
            <Shield className="h-3 w-3 text-amber-400" />
            Human-in-the-Loop
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-[#252540] bg-[#131320] px-3 py-1.5 text-xs text-[#8888a0]">
            <Rocket className="h-3 w-3 text-emerald-400" />
            One-Click Deploy
          </div>
        </div>
      </div>
    </div>
  );
}
