import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError, putToPresigned } from "@/api/client";
import type {
  CommentRecord,
  ProjectRecord,
  Role,
  TaskAuditRecord,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  UserRecord,
} from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { isManagerLike } from "@/lib/rbac";
import { STATUS_LABELS, TASK_STATUSES, priorityTone } from "@/lib/task-meta";
import { cn } from "@/lib/utils";

type Props = {
  task: TaskRecord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  viewerId: string;
  viewerRole: Role;
  users: UserRecord[];
  projects: ProjectRecord[];
  onChanged: () => void;
};

const selectCls =
  "flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

export function TaskDetailDialog(props: Props) {
  const { task, open, onOpenChange, viewerId, viewerRole, users, projects, onChanged } = props;
  const [detail, setDetail] = useState<TaskRecord | null>(null);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [audit, setAudit] = useState<TaskAuditRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPriority, setDraftPriority] = useState<TaskPriority>("MEDIUM");
  const [draftDeadline, setDraftDeadline] = useState("");
  const [draftStatus, setDraftStatus] = useState<TaskStatus>("TODO");
  const [draftAssignee, setDraftAssignee] = useState("");
  const [draftProjectId, setDraftProjectId] = useState("");

  useEffect(() => {
    setDetail(task);
  }, [task]);

  useEffect(() => {
    if (!detail || !open) return;
    setDraftTitle(detail.title);
    setDraftDescription(detail.description);
    setDraftPriority(detail.priority);
    setDraftDeadline(toLocalDatetimeValue(detail.deadline));
    setDraftStatus(detail.status);
    setDraftAssignee(detail.assigneeUserId);
    setDraftProjectId(detail.projectId);
  }, [detail, open]);

  const userMap = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);

  async function loadThread(taskId: string) {
    try {
      const [cRes, aRes] = await Promise.all([
        api.listComments(taskId),
        api.listTaskAudit(taskId),
      ]);
      setComments(cRes.comments.sort((x, y) => x.createdAt.localeCompare(y.createdAt)));
      setAudit(aRes.audit.sort((x, y) => x.at.localeCompare(y.at)));
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    }
  }

  async function reloadImage(t: TaskRecord) {
    if (!t.imageCurrentKey) {
      setImgUrl(null);
      return;
    }
    try {
      try {
        const { presigned } = await api.getAttachmentThumbUrl(t.taskId);
        setImgUrl(presigned.url);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          const { presigned } = await api.getAttachmentUrl(t.taskId);
          setImgUrl(presigned.url);
        } else {
          throw e;
        }
      }
    } catch {
      setImgUrl(null);
    }
  }

  useEffect(() => {
    if (!open || !task) return;
    void (async () => {
      setImgUrl(null);
      try {
        const { task: t } = await api.getTask(task.taskId);
        setDetail(t);
        await loadThread(t.taskId);
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message);
      }
    })();
  }, [open, task?.taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && detail) void reloadImage(detail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, detail?.taskId, detail?.imageCurrentKey]);

  async function patchAndRefresh(patch: {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    deadline?: string;
    status?: TaskStatus;
    assigneeUserId?: string;
    projectId?: string;
  }) {
    const t = detail;
    if (!t) return;
    setBusy(true);
    try {
      const { task: updated } = await api.updateTask(t.taskId, patch);
      setDetail(updated);
      await loadThread(updated.taskId);
      toast.success("Task updated.");
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error("Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdits() {
    await patchAndRefresh({
      title: draftTitle,
      description: draftDescription,
      priority: draftPriority,
      deadline: new Date(draftDeadline).toISOString(),
      status: draftStatus,
      assigneeUserId: draftAssignee,
      projectId: draftProjectId,
    });
  }

  async function addComment() {
    const trimmed = commentBody.trim();
    if (!trimmed) return;
    const t = detail;
    if (!t) return;
    setBusy(true);
    try {
      await api.addComment(t.taskId, trimmed);
      setCommentBody("");
      await loadThread(t.taskId);
      toast.success("Comment posted.");
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    const t = detail;
    if (!t) return;
    const ext = file.name.split(".").pop() || "bin";
    const contentType = file.type || "application/octet-stream";
    setBusy(true);
    try {
      const pres = await api.presignAttachment(t.taskId, { contentType, ext });
      await putToPresigned(pres.presigned.url, file, contentType);
      const { task: updated } = await api.commitAttachment(t.taskId, pres.key);
      setDetail(updated);
      toast.success("Image linked.");
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTask() {
    const t = detail;
    if (!t) return;
    if (!confirm(`Delete "${t.title}"?`)) return;
    setBusy(true);
    try {
      await api.deleteTask(t.taskId);
      toast.success("Task deleted.");
      onOpenChange(false);
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function labelUser(id: string) {
    return userMap.get(id)?.displayName ?? userMap.get(id)?.email ?? id.slice(0, 8);
  }

  const selectedProjectTeam = projects.find((p) => p.projectId === draftProjectId)?.teamId;
  const teamScopedUsers = users.filter(
    (u) => u.role !== "EMPLOYEE" || u.teamId === selectedProjectTeam,
  );

  const d = detail;
  if (!d) return null;

  const canManage = isManagerLike(viewerRole);
  const isAssignee = d.assigneeUserId === viewerId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,720px)] max-w-xl overflow-hidden p-0 sm:max-w-2xl">
        <Tabs defaultValue="details" className="flex max-h-[min(92vh,720px)] flex-col gap-0">
          <div className="border-b border-zinc-800 px-6 pt-5">
            <DialogHeader className="space-y-1 pb-4 text-left">
              <Badge variant={priorityTone(d.priority)}>{d.priority}</Badge>
              <DialogTitle className="text-xl">{d.title}</DialogTitle>
              <p className="font-mono text-xs text-zinc-500">{d.taskId}</p>
            </DialogHeader>
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="attachment">Attachment</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-6 pb-4 pt-4">
            <TabsContent value="details" className="mt-0 h-full outline-none">
              <ScrollArea className="max-h-[50vh] pr-4">
                {canManage ? (
                  <div className="space-y-4">
                    <Field label="Title">
                      <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
                    </Field>
                    <Field label="Description">
                      <Textarea value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Priority">
                        <select
                          className={cn(selectCls)}
                          value={draftPriority}
                          onChange={(e) => setDraftPriority(e.target.value as TaskPriority)}
                        >
                          {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as TaskPriority[]).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select
                          className={cn(selectCls)}
                          value={draftStatus}
                          onChange={(e) => setDraftStatus(e.target.value as TaskStatus)}
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Deadline">
                      <Input
                        type="datetime-local"
                        value={draftDeadline}
                        onChange={(e) => setDraftDeadline(e.target.value)}
                      />
                    </Field>
                    <Field label="Project">
                      <select
                        className={cn(selectCls)}
                        value={draftProjectId}
                        onChange={(e) => setDraftProjectId(e.target.value)}
                      >
                        {projects.map((p) => (
                          <option key={p.projectId} value={p.projectId}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Assignee">
                      <select
                        className={cn(selectCls)}
                        value={draftAssignee}
                        onChange={(e) => setDraftAssignee(e.target.value)}
                      >
                        {teamScopedUsers.map((u) => (
                          <option key={u.userId} value={u.userId}>
                            {u.displayName}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                ) : (
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Description</dt>
                      <dd className="mt-1 whitespace-pre-wrap">{d.description || "—"}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zinc-500">Status</dt>
                        <dd className="font-medium">{STATUS_LABELS[d.status]}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zinc-500">Priority</dt>
                        <dd className="font-medium">{d.priority}</dd>
                      </div>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Deadline</dt>
                      <dd className="font-mono text-xs">{format(new Date(d.deadline), "yyyy-MM-dd HH:mm")}</dd>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Employees progress tasks one stage at a time from the board.
                    </p>
                  </dl>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="comments" className="mt-0">
              <div className="flex max-h-[50vh] flex-col gap-3">
                <ScrollArea className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
                  <div className="flex flex-col gap-3">
                    {comments.length === 0 ? (
                      <p className="text-center text-sm text-zinc-500">No comments yet.</p>
                    ) : null}
                    {comments.map((c) => (
                      <article key={c.commentId} className="rounded-md border border-zinc-800 px-3 py-2">
                        <div className="flex justify-between gap-2 text-xs text-zinc-500">
                          <span>{labelUser(c.authorUserId)}</span>
                          <time dateTime={c.createdAt}>{format(new Date(c.createdAt), "MMM d HH:mm")}</time>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
                      </article>
                    ))}
                  </div>
                </ScrollArea>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="cmt">New comment</Label>
                  <Textarea
                    id="cmt"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Discuss progress..."
                  />
                  <Button type="button" size="sm" onClick={() => void addComment()} disabled={busy || !commentBody.trim()}>
                    Post
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <ScrollArea className="max-h-[50vh] pr-3">
                <ol className="space-y-3">
                  {audit.length === 0 ? (
                    <li className="text-sm text-zinc-500">No status changes logged yet.</li>
                  ) : null}
                  {[...audit].reverse().map((a) => (
                    <li key={a.auditId} className="flex flex-col rounded-md border border-zinc-800 px-3 py-2">
                      <div className="text-xs text-zinc-500">
                        {labelUser(a.actorUserId)} - {format(new Date(a.at), "MMM d yyyy HH:mm")}
                      </div>
                      <div className="mt-2 text-sm">
                        {(a.fromStatus ? STATUS_LABELS[a.fromStatus] : "start")}{" -> "}
                        <strong>{STATUS_LABELS[a.toStatus]}</strong>
                      </div>
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="attachment" className="mt-0 space-y-4">
              {!isAssignee && !canManage ? (
                <p className="text-sm text-zinc-500">Only managers or the assignee can upload.</p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="file">Attach or replace image</Label>
                  <Input
                    id="file"
                    type="file"
                    accept="image/*"
                    onChange={(ev) => {
                      const file = ev.target.files?.[0];
                      ev.target.value = "";
                      if (file) void uploadFile(file);
                    }}
                    disabled={busy}
                  />
                  <p className="text-xs text-zinc-500">Older versions remain in storage when replaced.</p>
                </div>
              )}
              {d.imageVersions.length > 1 ? (
                <p className="text-xs text-zinc-500">Version snapshots: {d.imageVersions.length}</p>
              ) : null}
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
                {imgUrl ? (
                  <img src={imgUrl} alt="Task attachment" className="max-h-72 w-full object-contain" />
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
                    No image attached
                  </div>
                )}
              </div>
            </TabsContent>
          </div>

          <Separator />

          <DialogFooter className="flex flex-row flex-wrap gap-2 border-t border-zinc-800 px-6 py-4 sm:justify-between">
            {canManage ? (
              <>
                <Button type="button" variant="destructive" size="sm" onClick={() => void removeTask()} disabled={busy}>
                  <Trash2 className="size-4" />
                  Delete
                </Button>
                <Button type="button" size="sm" onClick={() => void saveEdits()} disabled={busy}>
                  Save changes
                </Button>
              </>
            ) : (
              <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function toLocalDatetimeValue(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.valueOf())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}
