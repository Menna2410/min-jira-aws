export type Role = "MANAGER" | "EMPLOYEE" | "ADMIN";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AuthUser = {
  userId: string;
  email: string;
  role: Role;
  teamId?: string;
};

export type TeamRecord = {
  teamId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type UserRecord = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  teamId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRecord = {
  projectId: string;
  name: string;
  description?: string;
  teamId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskImageVersion = {
  key: string;
  uploadedAt: string;
  uploadedByUserId: string;
};

export type TaskRecord = {
  taskId: string;
  projectId: string;
  teamId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string;
  assigneeUserId: string;
  createdByUserId: string;
  imageCurrentKey?: string;
  imageVersions: TaskImageVersion[];
  createdAt: string;
  updatedAt: string;
};

export type CommentRecord = {
  taskId: string;
  commentId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
};

export type TaskAuditRecord = {
  taskId: string;
  auditId: string;
  actorUserId: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  at: string;
};

export type PresignedPayload = {
  url: string;
  fields?: Record<string, string>;
};
