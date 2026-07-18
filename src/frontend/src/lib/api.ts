const API_BASE = "";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = opts;

  const token = localStorage.getItem("pf_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (body && method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(res.status, error.error || "Request failed", error.details);
  }

  return res.json();
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Auth
export const api = {
  // Auth
  me: () => request<any>("/auth/me"),
  logout: () => request<any>("/auth/logout", { method: "POST" }),

  // Teams
  listTeams: () => request<any>("/api/teams"),
  createTeam: (data: { name: string; slug: string }) =>
    request<any>("/api/teams", { method: "POST", body: data }),
  getTeam: (teamId: string) => request<any>(`/api/teams/${teamId}`),
  updateTeam: (teamId: string, data: Record<string, unknown>) =>
    request<any>(`/api/teams/${teamId}`, { method: "PATCH", body: data }),
  listMembers: (teamId: string) => request<any>(`/api/teams/${teamId}/members`),
  inviteMember: (teamId: string, data: { email: string; role: string }) =>
    request<any>(`/api/teams/${teamId}/members`, { method: "POST", body: data }),
  removeMember: (teamId: string, userId: string) =>
    request<any>(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" }),

  // Dashboard
  getDashboard: (teamId: string) => request<any>(`/api/teams/${teamId}/dashboard`),
};
