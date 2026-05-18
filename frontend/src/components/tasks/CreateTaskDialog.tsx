import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";

import { api, ApiError } from "@/api/client";
import type { ProjectRecord, TaskPriority, UserRecord } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: ProjectRecord[];
  users: UserRecord[];
  onCreated: () => void;
};

const selectCls =
  "flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

export function CreateTaskDialog({ open, onOpenChange, projects, users, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [deadline, setDeadline] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedProject = useMemo(() => projects.find((p) => p.projectId === projectId), [projectId, projects]);

  const assignees = useMemo(() => {
    const teamId = selectedProject?.teamId;
    if (!teamId) return users;
    return users.filter((u) => u.role !== "EMPLOYEE" || u.teamId === teamId);
  }, [selectedProject?.teamId, users]);

  useEffect(() => {
    if (open && projects.length && !projectId) {
      setProjectId(projects[0]!.projectId);
    }
  }, [open, projects, projectId]);

  function reset(preservePid?: string) {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setDeadline("");
    setProjectId(preservePid ?? (projects[0]?.projectId ?? ""));
    setAssigneeUserId("");
  }

  async function submit() {
    if (!selectedProject || !deadline || !assigneeUserId || !title.trim()) {
      toast.error("Project, assignee, title, and deadline are required.");
      return;
    }
    setBusy(true);
    try {
      await api.createTask({
        projectId: selectedProject.projectId,
        teamId: selectedProject.teamId,
        title: title.trim(),
        description: description.trim(),
        priority,
        deadline: new Date(deadline).toISOString(),
        assigneeUserId,
      });
      toast.success("Task created.");
      reset(selectedProject.projectId);
      onOpenChange(false);
      onCreated();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error("Could not create task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset(projectId || undefined);
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Scoped to project team automatically for correct RBAC on the backend.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <select
              className={cn(selectCls)}
              value={projectId}
              onChange={(e) => {
                const next = e.target.value;
                setProjectId(next);
                setAssigneeUserId("");
              }}
            >
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                className={cn(selectCls)}
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dl">Deadline</Label>
              <Input id="dl" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assignee</Label>
            <select
              className={cn(selectCls)}
              value={assigneeUserId}
              onChange={(e) => setAssigneeUserId(e.target.value)}
            >
              <option value="">Select teammate</option>
              {assignees.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
