export interface Me {
  login: string;
  name: string | null;
  avatarUrl: string;
  email: string | null;
}

export interface Repo {
  id: number;
  repoHttpsUrl: string;
  owner: string;
  name: string;
  visibility: "public" | "private";
  defaultBranch: string;
  status: "connected" | "repo_missing" | "auth_invalid" | "push_denied";
  lastHealth: string | null;
  lastError: string | null;
  lastCommitAt: string | null;
  createdAt: string;
}

export interface Settings {
  scheduleMode: "fixed" | "random";
  fixedTime: string;
  randomFrom: string;
  randomTo: string;
  timezone: string;
  messageMode: "fixed" | "random";
  message: string;
  commitMode: "empty" | "log";
  commitsPerDay: number;
  commitsPerDayMode: "fixed" | "random";
  schedulerEnabled: boolean;
  burnEnabled: boolean;
  burnEveryDays: number;
  burnJitterDays: number;
  burnCommits: number;
}

export interface JobLog {
  id: number;
  repoId: number | null;
  ok: boolean;
  message: string;
  createdAt: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "요청에 실패했습니다");
  }
  return data as T;
}

export const api = {
  me: () => request<Me>("/api/auth/me"),
  login: (token: string) => request<Me>("/api/auth/login", { method: "POST", body: JSON.stringify({ token }) }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  repos: () => request<{ repos: Repo[] }>("/api/repos"),
  createRepo: (body: { name: string; visibility: "public" | "private"; description?: string }) =>
    request<{ id: number; repo: Repo }>("/api/repos/create", { method: "POST", body: JSON.stringify(body) }),
  connectRepo: (url: string) =>
    request<{ id: number; repo: Repo }>("/api/repos/connect", { method: "POST", body: JSON.stringify({ url }) }),
  deleteRepo: (id: number) => request<{ ok: boolean }>(`/api/repos/${id}`, { method: "DELETE" }),
  healthRepo: (id: number) =>
    request<{ status: Repo["status"]; error: string | null; repo: Repo }>(`/api/repos/${id}/health`, { method: "POST" }),
  settings: () => request<Settings>("/api/settings"),
  saveSettings: (body: Settings) => request<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(body) }),
  logs: () => request<{ logs: JobLog[]; grass: string[]; grassBurn: string[] }>("/api/logs"),
  runNow: (repoId?: number, forceBurn?: boolean) =>
    request<{ ok: boolean; repos: Repo[]; logs: JobLog[] }>("/api/run-now", {
      method: "POST",
      body: JSON.stringify({ ...(repoId ? { repoId } : {}), forceBurn: Boolean(forceBurn) })
    })
};
