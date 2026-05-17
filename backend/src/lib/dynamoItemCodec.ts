import type { AppConfig } from "../config.js";
import type {
  CommentRecord,
  ProjectRecord,
  TaskAuditRecord,
  TaskImageVersion,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  TeamRecord,
  UserRecord,
  Role,
} from "../types/index.js";
import { Roles, TaskPriorities, TaskStatuses } from "../types/index.js";

function str(item: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.length) return v;
  }
  return fallback;
}

function optStr(item: Record<string, unknown>, keys: string[]): string | undefined {
  const s = str(item, keys);
  return s || undefined;
}

function isRole(v: string): v is Role {
  return (Roles as readonly string[]).includes(v);
}

function isTaskStatus(v: string): v is TaskStatus {
  return (TaskStatuses as readonly string[]).includes(v);
}

function isTaskPriority(v: string): v is TaskPriority {
  return (TaskPriorities as readonly string[]).includes(v);
}

export function teamToItem(t: TeamRecord, cfg: AppConfig): Record<string, unknown> {
  return {
    [cfg.DYNAMO_ATTR_TEAM_ID]: t.teamId,
    name: t.name,
    ...(t.description !== undefined ? { description: t.description } : {}),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export function teamFromItem(raw: Record<string, unknown> | undefined, cfg: AppConfig): TeamRecord | undefined {
  if (!raw) return undefined;
  const teamId = str(raw, [cfg.DYNAMO_ATTR_TEAM_ID, "teamId"]);
  if (!teamId) return undefined;
  return {
    teamId,
    name: str(raw, ["name"]),
    description: optStr(raw, ["description"]),
    createdAt: str(raw, ["createdAt"]),
    updatedAt: str(raw, ["updatedAt"]),
  };
}

export function userToItem(u: UserRecord, cfg: AppConfig): Record<string, unknown> {
  return {
    [cfg.DYNAMO_ATTR_USER_ID]: u.userId,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    ...(u.teamId !== undefined ? { [cfg.DYNAMO_ATTR_USER_TEAM_ID]: u.teamId } : {}),
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export function userFromItem(raw: Record<string, unknown> | undefined, cfg: AppConfig): UserRecord | undefined {
  if (!raw) return undefined;
  const userId = str(raw, [cfg.DYNAMO_ATTR_USER_ID, "userId"]);
  if (!userId) return undefined;
  const roleStr = str(raw, ["role"]);
  if (!isRole(roleStr)) return undefined;
  const teamRaw = optStr(raw, [cfg.DYNAMO_ATTR_USER_TEAM_ID, "teamId"]);
  return {
    userId,
    email: str(raw, ["email"]),
    displayName: str(raw, ["displayName"]),
    role: roleStr,
    teamId: teamRaw,
    createdAt: str(raw, ["createdAt"]),
    updatedAt: str(raw, ["updatedAt"]),
  };
}

export function projectToItem(p: ProjectRecord, cfg: AppConfig): Record<string, unknown> {
  return {
    [cfg.DYNAMO_ATTR_PROJECT_ID]: p.projectId,
    [cfg.DYNAMO_ATTR_PROJECT_TEAM_ID]: p.teamId,
    name: p.name,
    ...(p.description !== undefined ? { description: p.description } : {}),
    createdByUserId: p.createdByUserId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function projectFromItem(raw: Record<string, unknown> | undefined, cfg: AppConfig): ProjectRecord | undefined {
  if (!raw) return undefined;
  const projectId = str(raw, [cfg.DYNAMO_ATTR_PROJECT_ID, "projectId"]);
  if (!projectId) return undefined;
  const teamId = str(raw, [cfg.DYNAMO_ATTR_PROJECT_TEAM_ID, "teamId"]);
  return {
    projectId,
    name: str(raw, ["name"]),
    description: optStr(raw, ["description"]),
    teamId,
    createdByUserId: str(raw, ["createdByUserId"]),
    createdAt: str(raw, ["createdAt"]),
    updatedAt: str(raw, ["updatedAt"]),
  };
}

function parseImageVersions(raw: unknown): TaskImageVersion[] {
  if (!Array.isArray(raw)) return [];
  const out: TaskImageVersion[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key : "";
    const uploadedAt = typeof o.uploadedAt === "string" ? o.uploadedAt : "";
    const uploadedByUserId = typeof o.uploadedByUserId === "string" ? o.uploadedByUserId : "";
    if (key && uploadedAt && uploadedByUserId) out.push({ key, uploadedAt, uploadedByUserId });
  }
  return out;
}

export function taskToItem(t: TaskRecord, cfg: AppConfig): Record<string, unknown> {
  return {
    [cfg.DYNAMO_ATTR_TASK_ID]: t.taskId,
    [cfg.DYNAMO_ATTR_PROJECT_ID]: t.projectId,
    [cfg.DYNAMO_ATTR_TASK_TEAM_ID]: t.teamId,
    [cfg.DYNAMO_ATTR_TASK_ASSIGNEE_ID]: t.assigneeUserId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    createdByUserId: t.createdByUserId,
    ...(t.imageCurrentKey !== undefined ? { imageCurrentKey: t.imageCurrentKey } : {}),
    imageVersions: t.imageVersions ?? [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export function taskFromItem(raw: Record<string, unknown> | undefined, cfg: AppConfig): TaskRecord | undefined {
  if (!raw) return undefined;
  const taskId = str(raw, [cfg.DYNAMO_ATTR_TASK_ID, "taskId"]);
  if (!taskId) return undefined;
  const statusStr = str(raw, ["status"]);
  const priStr = str(raw, ["priority"]);
  if (!isTaskStatus(statusStr) || !isTaskPriority(priStr)) return undefined;
  return {
    taskId,
    projectId: str(raw, [cfg.DYNAMO_ATTR_PROJECT_ID, "projectId"]),
    teamId: str(raw, [cfg.DYNAMO_ATTR_TASK_TEAM_ID, "teamId"]),
    title: str(raw, ["title"]),
    description: str(raw, ["description"]),
    status: statusStr,
    priority: priStr,
    deadline: str(raw, ["deadline"]),
    assigneeUserId: str(raw, [cfg.DYNAMO_ATTR_TASK_ASSIGNEE_ID, "assigneeUserId"]),
    createdByUserId: str(raw, ["createdByUserId"]),
    imageCurrentKey: optStr(raw, ["imageCurrentKey"]),
    imageVersions: parseImageVersions(raw.imageVersions),
    createdAt: str(raw, ["createdAt"]),
    updatedAt: str(raw, ["updatedAt"]),
  };
}

export function commentToItem(c: CommentRecord, cfg: AppConfig): Record<string, unknown> {
  return {
    [cfg.DYNAMO_ATTR_COMMENT_PARTITION]: c.taskId,
    [cfg.DYNAMO_ATTR_COMMENT_SORT]: c.commentId,
    authorUserId: c.authorUserId,
    body: c.body,
    createdAt: c.createdAt,
  };
}

export function commentFromItem(raw: Record<string, unknown> | undefined, cfg: AppConfig): CommentRecord | undefined {
  if (!raw) return undefined;
  const taskId = str(raw, [cfg.DYNAMO_ATTR_COMMENT_PARTITION, "taskId"]);
  const commentId = str(raw, [cfg.DYNAMO_ATTR_COMMENT_SORT, "commentId"]);
  if (!taskId || !commentId) return undefined;
  return {
    taskId,
    commentId,
    authorUserId: str(raw, ["authorUserId"]),
    body: str(raw, ["body"]),
    createdAt: str(raw, ["createdAt"]),
  };
}

export function auditToItem(a: TaskAuditRecord, cfg: AppConfig): Record<string, unknown> {
  return {
    [cfg.DYNAMO_ATTR_AUDIT_PARTITION]: a.taskId,
    [cfg.DYNAMO_ATTR_AUDIT_SORT]: a.auditId,
    actorUserId: a.actorUserId,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    at: a.at,
  };
}

export function auditFromItem(raw: Record<string, unknown> | undefined, cfg: AppConfig): TaskAuditRecord | undefined {
  if (!raw) return undefined;
  const taskId = str(raw, [cfg.DYNAMO_ATTR_AUDIT_PARTITION, "taskId"]);
  const auditId = str(raw, [cfg.DYNAMO_ATTR_AUDIT_SORT, "auditId"]);
  if (!taskId || !auditId) return undefined;
  const fromRaw = raw.fromStatus;
  const fromStatus =
    fromRaw === null || fromRaw === undefined
      ? null
      : typeof fromRaw === "string" && isTaskStatus(fromRaw)
        ? fromRaw
        : null;
  const toRaw = raw.toStatus;
  const toStatus = typeof toRaw === "string" && isTaskStatus(toRaw) ? toRaw : "TODO";
  return {
    taskId,
    auditId,
    actorUserId: str(raw, ["actorUserId"]),
    fromStatus,
    toStatus,
    at: str(raw, ["at"]),
  };
}
