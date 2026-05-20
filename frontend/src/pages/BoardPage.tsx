import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/api/client";
import type { ProjectRecord, TaskRecord, TaskStatus, TeamRecord, UserRecord } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isManagerLike } from "@/lib/rbac";

export function BoardPage() {
  const { me } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const viewerIsLead = me ? isManagerLike(me.role) : false;

  const reloadEverything = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try {
      const teamRes = await api.listTeams();
      setTeams(teamRes.teams);
      const projectRes = await api.listProjects();
      setProjects(projectRes.projects);

      let userList: UserRecord[] = [];
      if (isManagerLike(me.role)) {
        const uRes = await api.listUsers();
        userList = uRes.users;
      }
      setUsers(userList);

      const tRes = await api.listTasks(viewerIsLead && teamFilter ? { teamId: teamFilter } : undefined);
      setTasks(tRes.tasks);
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error("Failed loading board.");
    } finally {
      setLoading(false);
    }
  }, [me, viewerIsLead, teamFilter]);

  useEffect(() => {
    void reloadEverything();
  }, [reloadEverything]);

  const userMap = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);

  function userLabel(id: string) {
    if (me?.userId === id) return "You";
    const u = userMap.get(id);
    if (u) return u.displayName;
    return id.slice(0, 10);
  }

  async function handleMove(taskId: string, status: TaskStatus) {
    const prev = structuredClone(tasks);
    try {
      setTasks((curr) =>
        curr.map((t) => (t.taskId === taskId ? { ...t, status } : t)),
      );
      const { task } = await api.updateTask(taskId, { status });
      setTasks((curr) =>
        curr.map((t) => (t.taskId === task.taskId ? task : t)),
      );
      toast.success("Status updated.");
    } catch (e) {
      setTasks(prev);
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error("Could not update status.");
    }
  }

  function openDetail(t: TaskRecord) {
    setActiveTask(t);
    setDetailOpen(true);
  }

  if (!me) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  const emptyTeams = teams.length === 0;
  const emptyProjects = projects.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-emerald-500/90">
            <LayoutGrid className="size-4" />
            Team board
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Kanban workspace</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Columns mirror the server-enforced statuses. Employees see every task on their team; only assignees can drag
            cards forward one lane at a time.
          </p>
          {viewerIsLead && (
            <p className="mt-2 max-w-xl text-xs text-zinc-500">
              Showing {teamFilter ? `team ${teams.find((x) => x.teamId === teamFilter)?.name ?? teamFilter}` : "every team"}.
              Server-side RBAC guarantees employees never receive off-team tasks via the API even if IDs are guessed.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {viewerIsLead ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-wide text-zinc-500" htmlFor="team-filter">
                  Team filter
                </label>
                <select
                  id="team-filter"
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="h-10 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm"
                >
                  <option value="">All teams</option>
                  {teams.map((t) => (
                    <option key={t.teamId} value={t.teamId}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => setCreateOpen(true)} disabled={emptyProjects}>
                  New task
                </Button>
                <Button variant="outline" onClick={() => void reloadEverything()}>
                  Refresh
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" onClick={() => void reloadEverything()}>
              Refresh
            </Button>
          )}
        </div>
      </header>

      {viewerIsLead && emptyProjects ? (
        <div className="rounded-xl border border-amber-800/70 bg-amber-950/20 px-6 py-8 text-amber-200">
          Create a team (admin) plus a managed project before tasks can appear on this workspace.
        </div>
      ) : null}

      {viewerIsLead && emptyTeams ? (
        <div className="rounded-xl border border-zinc-800 px-6 py-6 text-sm text-zinc-400">
          No teams have been seeded yet — ask your admin workspace user to populate Teams.
        </div>
      ) : null}

      <KanbanBoard
        viewer={me}
        tasks={tasks}
        loading={loading}
        userLabel={userLabel}
        onMove={handleMove}
        onOpenTask={openDetail}
      />

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projects={projects}
        users={users}
        onCreated={() => void reloadEverything()}
      />

      <TaskDetailDialog
        task={activeTask}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setActiveTask(null);
        }}
        viewerId={me.userId}
        viewerRole={me.role}
        users={users}
        projects={projects}
        onChanged={() => void reloadEverything()}
      />
    </div>
  );
}
