import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

// Module-level guard: OAuth codes can only be used once.
// React StrictMode double-invokes useEffect, which would fire the
// exchange twice — the second call consumes the already-used code
// and GitHub returns "bad_verification_code".
let exchangeInitiated = false;

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exchangeInitiated) return;
    exchangeInitiated = true;

    const code = searchParams.get("code");
    if (!code) {
      setError("Missing authorization code from GitHub.");
      return;
    }

    // Call backend callback endpoint (URL-encode params to handle special chars)
    fetch(`/auth/github/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(searchParams.get("state") || "")}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Authentication failed");
        }
        return res.json();
      })
      .then((data) => {
        localStorage.setItem("pf_token", data.token);
        if (data.refreshToken) {
          localStorage.setItem("pf_refresh_token", data.refreshToken);
        }
        refresh().then(() => navigate("/"));
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [searchParams, navigate, refresh]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => navigate("/login")}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-[#8888a0]">Signing you in...</p>
      </div>
    </div>
  );
}
