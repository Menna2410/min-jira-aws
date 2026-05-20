import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { format } from "date-fns";
import { useState, type CSSProperties } from "react";

import type { AuthUser, TaskRecord, TaskStatus } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  COLUMN_DROP_PREFIX,
  STATUS_LABELS,
  TASK_STATUSES,
  employeeCanMove,
  priorityTone,
  statusFromDropTarget,
} from "@/lib/task-meta";

export type KanbanBoardProps = {
  tasks: TaskRecord[];
  viewer: AuthUser | null;
  loading?: boolean;
  userLabel: (userId: string) => string;
  onOpenTask?: (task: TaskRecord) => void;
  onMove: (taskId: string, status: TaskStatus) => Promise<void>;
};

export function KanbanBoard({ tasks, viewer, loading, userLabel, onOpenTask, onMove }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);

  function employeeMayDrag(task: TaskRecord) {
    if (!viewer || viewer.role !== "EMPLOYEE") return true;
    return task.assigneeUserId === viewer.userId;
  }

  async function commitMove(task: TaskRecord, target: TaskStatus) {
    if (task.status === target) return;
    if (!employeeMayDrag(task)) return;
    if (viewer?.role === "EMPLOYEE" && !employeeCanMove(task.status, target)) return;
    await onMove(task.taskId, target);
  }

  const onDragEnd = async (evt: DragEndEvent) => {
    setActiveTask(null);
    const tid = evt.active.id as string;
    const task = tasks.find((t) => t.taskId === tid);
    const overStr = evt.over?.id?.toString();
    const status = statusFromDropTarget(overStr, tasks);
    if (!task || !status) return;
    try {
      await commitMove(task, status);
    } catch {
      /* parent toast */
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((s) => (
          <Skeleton key={s} className="h-[420px]" />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => {
        const t = tasks.find((x) => x.taskId === e.active.id);
        setActiveTask(t ?? null);
      }}
      onDragCancel={() => setActiveTask(null)}
      onDragEnd={onDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {TASK_STATUSES.map((status) => {
          const items = tasks.filter((t) => t.status === status);
          return (
            <KanbanColumn
              key={status}
              status={status}
              items={items}
              viewer={viewer}
              userLabel={userLabel}
              onOpenTask={onOpenTask}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="max-w-[280px] cursor-grabbing">
            <TaskCardGhost task={activeTask} userLabel={userLabel} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  items,
  viewer,
  userLabel,
  onOpenTask,
}: {
  status: TaskStatus;
  items: TaskRecord[];
  viewer: AuthUser | null;
  userLabel: (userId: string) => string;
  onOpenTask?: (task: TaskRecord) => void;
}) {
  const droppableId = `${COLUMN_DROP_PREFIX}${status}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { status },
  });

  return (
    <Card
      ref={setNodeRef}
      className={cn("flex flex-col gap-3 p-4 transition-[outline]", isOver ? "outline outline-2 outline-emerald-500/70" : "")}
    >
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{STATUS_LABELS[status]}</h2>
          <p className="text-xl font-semibold tabular-nums">{items.length}</p>
        </div>
      </div>
      <div className="flex min-h-40 flex-col gap-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-center text-sm text-zinc-500">
            Nothing here yet.
          </p>
        ) : null}
        {items.map((task) => (
          <KanbanCard
            key={task.taskId}
            task={task}
            viewer={viewer}
            userLabel={userLabel}
            onOpen={onOpenTask}
          />
        ))}
      </div>
    </Card>
  );
}

function KanbanCard({
  task,
  viewer,
  userLabel,
  onOpen,
}: {
  task: TaskRecord;
  viewer: AuthUser | null;
  userLabel: (userId: string) => string;
  onOpen?: (t: TaskRecord) => void;
}) {
  const draggable =
    !viewer || viewer.role !== "EMPLOYEE" || task.assigneeUserId === viewer.userId;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.taskId,
    disabled: !draggable,
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3 shadow-inner">
        {draggable ? (
          <button
            type="button"
            {...listeners}
            {...attributes}
            className="-ml-1 flex items-start pt-1 text-zinc-500 hover:text-emerald-400"
            aria-label="Drag task"
          >
            <GripVertical className="size-5" />
          </button>
        ) : (
          <span className="-ml-1 w-5 shrink-0" aria-hidden />
        )}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen?.(task)}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="line-clamp-2 font-medium leading-snug">{task.title}</p>
          </div>
          <Badge variant={priorityTone(task.priority)} className="mt-2">
            {task.priority}
          </Badge>
          <p className="mt-1 text-xs text-zinc-400">Assignee · {userLabel(task.assigneeUserId)}</p>
          <p className="text-xs text-zinc-500">{formatDeadline(task.deadline)}</p>
        </button>
      </div>
    </div>
  );
}

function TaskCardGhost({ task, userLabel }: { task: TaskRecord; userLabel: (userId: string) => string }) {
  return (
    <Card className="border-emerald-500/40 bg-zinc-900 p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <GripVertical className="mt-1 size-5 text-zinc-500" />
        <div className="min-w-0">
          <p className="font-medium leading-snug">{task.title}</p>
          <Badge variant={priorityTone(task.priority)} className="mt-2">
            {task.priority}
          </Badge>
          <p className="mt-2 text-xs text-zinc-400">{userLabel(task.assigneeUserId)}</p>
        </div>
      </div>
    </Card>
  );
}

function formatDeadline(raw: string) {
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.valueOf())) return raw;
    return format(d, "MMM d · HH:mm");
  } catch {
    return raw;
  }
}
