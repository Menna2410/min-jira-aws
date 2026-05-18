import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { api, ApiError } from "@/api/client";
import type { ProjectRecord, TeamRecord } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { isManagerLike } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const selectCls =
  "flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

export function ProjectsPage() {
  const { me } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        api.listProjects(),
        api.listTeams(),
      ]);
      setProjects(pRes.projects);
      setTeams(tRes.teams);
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error("Failed loading projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const teamLookup = useMemo(() => new Map(teams.map((t) => [t.teamId, t])), [teams]);

  if (!me || !isManagerLike(me.role)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14 text-center text-sm text-zinc-400">
        Only managers may curate portfolios. Reach out when you promote this account&apos;s Cognito{' '}
        <code className="text-emerald-300">custom:role</code>.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Projects</h2>
          <p className="mt-2 text-sm text-zinc-400">Each project inherits a Dynamo partition key from its owning team.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            Reload
          </Button>
          <CreateProjectInline teams={teams} onSaved={() => void load()} />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState teams={teams} onCreated={() => void load()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.projectId}>
              <CardHeader>
                <Badge variant="default">{teamLookup.get(project.teamId)?.name ?? project.teamId}</Badge>
                <CardTitle className="mt-2 text-xl">{project.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-400">
                <p>{project.description || "No description captured."}</p>
                <p className="mt-3 font-mono text-xs opacity-75">{project.projectId}</p>
              </CardContent>
              <CardFooter className="flex justify-between gap-2">
                <EditProjectDialog project={project} teams={teams} onSaved={() => void load()} />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    const ok = confirm(`Archive project "${project.name}" permanently? Tasks may still reference it.`);
                    if (!ok) return;
                    try {
                      await api.deleteProject(project.projectId);
                      toast.success("Project deleted.");
                      void load();
                    } catch (e) {
                      if (e instanceof ApiError) toast.error(e.message);
                    }
                  }}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ teams, onCreated }: { teams: TeamRecord[]; onCreated: () => void }) {
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center border-dashed p-12 text-center">
      <CardHeader>
        <CardTitle>No projects detected</CardTitle>
      </CardHeader>
      <CardContent className="text-zinc-400">
        Provision the first backlog so managers can associate tasks via <code>[projectId, teamId]</code> coupling.
      </CardContent>
      <CardFooter>
        <CreateProjectInline teams={teams} variant="outline" label="Kick off workspace" onSaved={onCreated} />
      </CardFooter>
    </Card>
  );
}

function CreateProjectInline({
  teams,
  onSaved,
  variant = "default",
  label = "Create project",
}: {
  teams: TeamRecord[];
  onSaved: () => void;
  variant?: "default" | "outline";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [teamId, setTeamId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && teams.length && !teamId) setTeamId(teams[0]!.teamId);
  }, [open, teams, teamId]);

  async function submit() {
    if (!teamId || !name.trim()) {
      toast.error("Provide a descriptive name plus team affinity.");
      return;
    }
    setBusy(true);
    try {
      await api.createProject({ name: name.trim(), description: desc.trim(), teamId });
      toast.success("Project created.");
      setOpen(false);
      setName("");
      setDesc("");
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={!teams.length}>
        {teams.length === 0 ? "Need teams first" : label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch project</DialogTitle>
            <DialogDescription>Select the owning team carefully — workers cannot reconcile divergent shards later.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Team</Label>
              <select className={cn(selectCls)} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void submit()}>
              Save project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditProjectDialog({
  project,
  teams,
  onSaved,
}: {
  project: ProjectRecord;
  teams: TeamRecord[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description ?? "");
  const [teamId, setTeamId] = useState(project.teamId);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDesc(project.description ?? "");
      setTeamId(project.teamId);
    }
  }, [open, project.description, project.name, project.teamId]);

  async function submit() {
    setBusy(true);
    try {
      await api.updateProject(project.projectId, {
        name: name.trim(),
        description: desc.trim(),
        teamId,
      });
      toast.success("Project updated.");
      setOpen(false);
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update portfolio</DialogTitle>
            <DialogDescription>Moving teams invalidates lingering tasks — pair with diligent backlog grooming.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Team</Label>
              <select className={cn(selectCls)} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void submit()}>
              Save edits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
