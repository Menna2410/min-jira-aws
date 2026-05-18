import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { api, ApiError } from "@/api/client";
import type { TeamRecord } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function TeamsAdminPage() {
  const { me } = useAuth();
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { teams: ts } = await api.listTeams();
      setTeams(ts);
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!me) return null;

  if (me.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-zinc-100">Privileged surface</h2>
        <p className="mt-3 text-sm text-zinc-400">
          Team lifecycle APIs require the Cognito ADMIN profile; ask your infra owner to hoist your claims.
        </p>
      </div>
    );
  }

  async function createTeam() {
    if (!name.trim()) {
      toast.error("Teams deserve a succinct label.");
      return;
    }
    setBusy(true);
    try {
      await api.createTeam({ name: name.trim(), description: desc.trim() || undefined });
      toast.success("Team created.");
      setCreateOpen(false);
      setName("");
      setDesc("");
      void load();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveTeam(teamId: string, body: { name: string; description?: string }) {
    try {
      await api.updateTeam(teamId, body);
      toast.success("Team saved.");
      void load();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    }
  }

  async function remove(teamId: string) {
    if (!confirm("Delete team from Dynamo?")) return;
    try {
      await api.deleteTeam(teamId);
      toast.success("Team removed.");
      void load();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Teams governance</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Align changes with Cognito <code className="text-emerald-300">custom:teamId</code> before asking users to
            sign in again.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Provision team</Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create team shard</DialogTitle>
            <DialogDescription>Appears globally for managers assigning backlogs.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void createTeam()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {teams.map((t) => (
            <Card key={t.teamId}>
              <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{t.name}</CardTitle>
                  <p className="font-mono text-xs text-zinc-500">{t.teamId}</p>
                </div>
                <div className="flex gap-2">
                  <EditTeamDialog team={t} onSave={(payload) => void saveTeam(t.teamId, payload)} />
                  <Button size="sm" variant="destructive" onClick={() => void remove(t.teamId)}>
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">{t.description || "—"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EditTeamDialog({
  team,
  onSave,
}: {
  team: TeamRecord;
  onSave: (next: { name: string; description?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(team.name);
  const [blurb, setBlurb] = useState(team.description ?? "");

  useEffect(() => {
    if (!open) return;
    setLabel(team.name);
    setBlurb(team.description ?? "");
  }, [open, team.description, team.name]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {team.name}</DialogTitle>
            <DialogDescription>Updates Dynamo immediately.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={4} value={blurb} onChange={(e) => setBlurb(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const trimmed = label.trim();
                if (!trimmed) return;
                onSave({ name: trimmed, description: blurb.trim() || undefined });
                setOpen(false);
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
