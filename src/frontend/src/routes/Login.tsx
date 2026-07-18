import { useAuth } from "../hooks/useAuth";
import { Activity, Github } from "lucide-react";

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Activity className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-[#e4e4f0]">PipelineForge</h1>
          <p className="mt-2 text-sm text-[#8888a0]">
            AI-powered CI/CD automation for engineering teams
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-[#252540] bg-[#131320] p-6">
          <button
            onClick={login}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#24292e] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2c343a]"
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
      </div>
    </div>
  );
}
