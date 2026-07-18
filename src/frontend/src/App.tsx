import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Shell } from "./components/layout/Shell";
import Dashboard from "./routes/Dashboard";
import Pipelines from "./routes/Pipelines";
import PipelineDetail from "./routes/PipelineDetail";
import CreatePipeline from "./routes/CreatePipeline";
import RunDetail from "./routes/RunDetail";
import Repositories from "./routes/Repositories";
import Settings from "./routes/Settings";
import Login from "./routes/Login";
import AuthCallback from "./routes/AuthCallback";
import Onboarding from "./routes/Onboarding";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted">Loading PipelineForge...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/onboarding"
        element={
          user ? (
            (user.teams && user.teams.length > 0) ? (
              <Navigate to="/" />
            ) : (
              <Onboarding />
            )
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/*"
        element={
          user ? (
            (user.teams && user.teams.length > 0) ? (
              <Shell>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/pipelines" element={<Pipelines />} />
                  <Route path="/pipelines/new" element={<CreatePipeline />} />
                  <Route path="/pipelines/:pipelineId" element={<PipelineDetail />} />
                  <Route path="/pipelines/:pipelineId/runs/:runId" element={<RunDetail />} />
                  <Route path="/repositories" element={<Repositories />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Shell>
            ) : (
              <Navigate to="/onboarding" />
            )
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}
