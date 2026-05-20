import type { TaskPriority, TaskStatus } from "@/api/types";

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

export const COLUMN_DROP_PREFIX = "col:";

export function statusFromDropTarget(
  overId: string | undefined,
  tasks: { taskId: string; status: TaskStatus }[],
): TaskStatus | null {
  if (!overId) return null;
  if (overId.startsWith(COLUMN_DROP_PREFIX)) {
    return overId.slice(COLUMN_DROP_PREFIX.length) as TaskStatus;
  }
  const t = tasks.find((x) => x.taskId === overId);
  return t?.status ?? null;
}

export function employeeCanMove(from: TaskStatus, to: TaskStatus) {
  const i = TASK_STATUSES.indexOf(from);
  const j = TASK_STATUSES.indexOf(to);
  if (i < 0 || j < 0) return false;
  return j === i + 1;
}

export function employeeNextStatus(from: TaskStatus): TaskStatus | null {
  const i = TASK_STATUSES.indexOf(from);
  if (i < 0 || i >= TASK_STATUSES.length - 1) return null;
  return TASK_STATUSES[i + 1] ?? null;
}

export function priorityTone(priority: TaskPriority): "danger" | "warning" | "success" | "default" {
  if (priority === "CRITICAL") return "danger";
  if (priority === "HIGH") return "warning";
  if (priority === "LOW") return "success";
  return "default";
}
