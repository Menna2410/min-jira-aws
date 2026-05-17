export const Roles = ["MANAGER", "EMPLOYEE", "ADMIN"] as const;
export type Role = (typeof Roles)[number];

export const TaskStatuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
export type TaskStatus = (typeof TaskStatuses)[number];

export const TaskPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type TaskPriority = (typeof TaskPriorities)[number];

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

export type AuthUser = {
  userId: string;
  email: string;
  role: Role;
  teamId?: string;
};
