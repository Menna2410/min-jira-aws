import { fetchAuthSession } from "aws-amplify/auth";
import type {
  AuthUser,
  CommentRecord,
  PresignedPayload,
  ProjectRecord,
  TaskAuditRecord,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  TeamRecord,
  UserRecord,
} from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const baseUrl = () => (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function idToken(): Promise<string> {
  const s = await fetchAuthSession({ forceRefresh: false });
  const t = s.tokens?.idToken?.toString();
  if (!t) throw new ApiError("Not signed in", 401, "UNAUTHORIZED");
  return t;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = await idToken();
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText || "Request failed";
    let code: string | undefined;
    let detailsFromBody: unknown;
    try {
      const j = (await res.json()) as { error?: string; code?: string; details?: unknown };
      if (typeof j.error === "string") message = j.error;
      if (typeof j.code === "string") code = j.code;
      detailsFromBody = j.details;
    } catch {
      /* ignore */
    }
    if (detailsFromBody !== undefined && String(detailsFromBody).trim()) {
      message = `${message} — ${typeof detailsFromBody === "string" ? detailsFromBody : JSON.stringify(detailsFromBody)}`;
    }
    throw new ApiError(message, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  async getMe(): Promise<{ user: AuthUser }> {
    return request("/api/me");
  },

  async listTeams(): Promise<{ teams: TeamRecord[] }> {
    return request("/api/teams");
  },

  async createTeam(body: { name: string; description?: string }): Promise<{ team: TeamRecord }> {
    return request("/api/teams", { method: "POST", body: JSON.stringify(body) });
  },

  async updateTeam(
    teamId: string,
    body: { name?: string; description?: string },
  ): Promise<{ team: TeamRecord }> {
    return request(`/api/teams/${encodeURIComponent(teamId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  async deleteTeam(teamId: string): Promise<void> {
    await request(`/api/teams/${encodeURIComponent(teamId)}`, { method: "DELETE" });
  },

  async listUsers(): Promise<{ users: UserRecord[] }> {
    return request("/api/users");
  },

  async listProjects(): Promise<{ projects: ProjectRecord[] }> {
    return request("/api/projects");
  },

  async getProject(projectId: string): Promise<{ project: ProjectRecord }> {
    return request(`/api/projects/${encodeURIComponent(projectId)}`);
  },

  async createProject(body: {
    name: string;
    description?: string;
    teamId: string;
  }): Promise<{ project: ProjectRecord }> {
    return request("/api/projects", { method: "POST", body: JSON.stringify(body) });
  },

  async updateProject(
    projectId: string,
    body: { name?: string; description?: string; teamId?: string },
  ): Promise<{ project: ProjectRecord }> {
    return request(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  async deleteProject(projectId: string): Promise<void> {
    await request(`/api/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
  },

  async listTasks(params?: { teamId?: string }): Promise<{ tasks: TaskRecord[] }> {
    const q = new URLSearchParams();
    if (params?.teamId) q.set("teamId", params.teamId);
    const suffix = q.toString() ? `?${q}` : "";
    return request(`/api/tasks${suffix}`);
  },

  async getTask(taskId: string): Promise<{ task: TaskRecord }> {
    return request(`/api/tasks/${encodeURIComponent(taskId)}`);
  },

  async createTask(body: {
    projectId: string;
    teamId: string;
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    deadline: string;
    assigneeUserId: string;
    imageCurrentKey?: string;
  }): Promise<{ task: TaskRecord }> {
    return request("/api/tasks", { method: "POST", body: JSON.stringify(body) });
  },

  async updateTask(
    taskId: string,
    body: Partial<{
      title: string;
      description: string;
      priority: TaskPriority;
      deadline: string;
      assigneeUserId: string;
      teamId: string;
      projectId: string;
      status: TaskStatus;
      imageCurrentKey: string;
    }>,
  ): Promise<{ task: TaskRecord }> {
    return request(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  async deleteTask(taskId: string): Promise<void> {
    await request(`/api/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
  },

  async listTaskAudit(taskId: string): Promise<{ audit: TaskAuditRecord[] }> {
    return request(`/api/tasks/${encodeURIComponent(taskId)}/audit`);
  },

  async listComments(taskId: string): Promise<{ comments: CommentRecord[] }> {
    return request(`/api/tasks/${encodeURIComponent(taskId)}/comments`);
  },

  async addComment(taskId: string, body: string): Promise<{ comment: CommentRecord }> {
    return request(`/api/tasks/${encodeURIComponent(taskId)}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  },

  async presignAttachment(
    taskId: string,
    opts?: { contentType?: string; ext?: string },
  ): Promise<{ presigned: PresignedPayload; key: string }> {
    return request(`/api/tasks/${encodeURIComponent(taskId)}/attachments/presign`, {
      method: "POST",
      body: JSON.stringify({
        contentType: opts?.contentType ?? "application/octet-stream",
        ext: opts?.ext ?? "jpg",
      }),
    });
  },

  async commitAttachment(taskId: string, key: string): Promise<{ task: TaskRecord }> {
    return request(`/api/tasks/${encodeURIComponent(taskId)}/attachments/commit`, {
      method: "POST",
      body: JSON.stringify({ key }),
    });
  },

  /** Presigned JPEG thumbnail (`S3_RESIZED_BUCKET`); 404 → use {@link getAttachmentUrl}. */
  async getAttachmentThumbUrl(taskId: string): Promise<{ presigned: PresignedPayload }> {
    return request(`/api/tasks/${encodeURIComponent(taskId)}/attachments/thumb-url`);
  },

  /** Returns a GET presigned URL (string) nested in `{ presigned: { url } }` — shape matches backend */
  async getAttachmentUrl(taskId: string, key?: string): Promise<{ presigned: PresignedPayload }> {
    const q = key ? `?key=${encodeURIComponent(key)}` : "";
    return request(`/api/tasks/${encodeURIComponent(taskId)}/attachments/url${q}`);
  },
};

export async function putToPresigned(
  url: string,
  file: Blob,
  contentType?: string,
): Promise<void> {
  const headers = new Headers();
  if (contentType) headers.set("Content-Type", contentType);
  const put = await fetch(url, { method: "PUT", body: file, headers });
  if (!put.ok) {
    throw new ApiError(`S3 upload failed (${put.status})`, put.status);
  }
}
