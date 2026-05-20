import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/api/client";
import type { TeamRecord, UserRecord } from "@/api/types";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const selectCls =
  "flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

export function TeamsAdminPage() {
  const { me } = useAuth();
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [membersTeam, setMembersTeam] = useState<TeamRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setUsersError(null);
    try {
      const { teams: ts } = await api.listTeams();
      setTeams(ts);
      try {
        const { users: us } = await api.listUsers();
        setUsers(us);
      } catch (e) {
        setUsers([]);
        setUsersError(e instanceof ApiError ? e.message : "Could not load users.");
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usersByTeam = useMemo(() => {
    const map = new Map<string, UserRecord[]>();
    for (const t of teams) map.set(t.teamId, []);
    const unassigned: UserRecord[] = [];
    for (const u of users) {
      if (u.teamId && map.has(u.teamId)) {
        map.get(u.teamId)!.push(u);
      } else {
        unassigned.push(u);
      }
    }
    return { map, unassigned };
  }, [teams, users]);

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
      const { team } = await api.createTeam({ name: name.trim(), description: desc.trim() || undefined });
      toast.success("Team created — add members next.");
      setCreateOpen(false);
      setName("");
      setDesc("");
      await load();
      setMembersTeam(team);
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

  async function assignUserTeam(userId: string, teamId: string) {
    try {
      await api.updateUser(userId, { teamId: teamId ? teamId : "" });
      toast.success("User assigned to team (Dynamo + Cognito).");
      void load();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error("Assignment failed.");
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
      <div className="border-b border-zinc-900 pb-6">
        <h2 className="text-3xl font-semibold tracking-tight">Teams & members</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Create teams under <strong className="font-medium text-zinc-300">Teams</strong>, then assign people under{" "}
          <strong className="font-medium text-zinc-300">Members</strong> (or use Manage members on each team card).
        </p>
      </div>

      <Tabs defaultValue="members">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="members" className="gap-2">
            <Users className="size-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6 space-y-6">
          {usersError ? (
            <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
              {usersError}
              <p className="mt-2 text-xs text-amber-200/80">
                Redeploy the backend with the latest code so <code className="text-emerald-300">PATCH /api/users/:id</code>{" "}
                exists.
              </p>
            </div>
          ) : null}

          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : users.length === 0 ? (
            <Card className="border-dashed border-zinc-700">
              <CardContent className="py-10 text-center text-sm text-zinc-400">
                <p>No users in the directory yet.</p>
                <p className="mt-2">
                  Each person must sign in at least once so their profile is stored — then return here to assign teams.
                </p>
              </CardContent>
            </Card>
          ) : teams.length === 0 ? (
            <Card className="border-dashed border-zinc-700">
              <CardContent className="py-10 text-center text-sm text-zinc-400">
                Create a team first (Teams tab), then assign members here.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">All users</CardTitle>
                  <p className="text-sm font-normal text-zinc-400">Pick a team for each account.</p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="pb-3 pr-4">User</th>
                        <th className="pb-3 pr-4">Role</th>
                        <th className="pb-3">Team</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.userId} className="border-b border-zinc-800/80 last:border-0">
                          <td className="py-3 pr-4">
                            <p className="font-medium">{u.displayName}</p>
                            <p className="text-xs text-zinc-500">{u.email}</p>
                          </td>
                          <td className="py-3 pr-4">{u.role}</td>
                          <td className="py-3">
                            <select
                              className={cn(selectCls, "max-w-xs")}
                              value={u.teamId ?? ""}
                              onChange={(e) => void assignUserTeam(u.userId, e.target.value)}
                            >
                              <option value="">No team</option>
                              {teams.map((t) => (
                                <option key={t.teamId} value={t.teamId}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">By team</h3>
                {teams.map((t) => {
                  const members = usersByTeam.map.get(t.teamId) ?? [];
                  return (
                    <Card key={t.teamId}>
                      <CardHeader className="flex flex-row items-center justify-between gap-2 py-4">
                        <div>
                          <CardTitle className="text-base">{t.name}</CardTitle>
                          <p className="text-xs text-zinc-500">{members.length} member(s)</p>
                        </div>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => setMembersTeam(t)}>
                          <UserPlus className="size-4" />
                          Manage members
                        </Button>
                      </CardHeader>
                      {members.length > 0 ? (
                        <CardContent className="pt-0">
                          <ul className="flex flex-wrap gap-2">
                            {members.map((m) => (
                              <li
                                key={m.userId}
                                className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs"
                              >
                                {m.displayName}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="teams" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>Create team</Button>
          </div>

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
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{t.name}</CardTitle>
                      <p className="font-mono text-xs text-zinc-500">{t.teamId}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" className="gap-1" onClick={() => setMembersTeam(t)}>
                        <UserPlus className="size-4" />
                        Manage members
                      </Button>
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
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create team</DialogTitle>
            <DialogDescription>
              Name and description only. After saving, you will be prompted to add members to this team.
            </DialogDescription>
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
              Save & add members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManageMembersDialog
        team={membersTeam}
        users={users}
        open={membersTeam !== null}
        onOpenChange={(open) => {
          if (!open) setMembersTeam(null);
        }}
        onAssign={(userId, teamId) => assignUserTeam(userId, teamId)}
      />
    </div>
  );
}

function ManageMembersDialog({
  team,
  users,
  open,
  onOpenChange,
  onAssign,
}: {
  team: TeamRecord | null;
  users: UserRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (userId: string, teamId: string) => void | Promise<void>;
}) {
  const [pickUserId, setPickUserId] = useState("");

  useEffect(() => {
    if (open) setPickUserId("");
  }, [open, team?.teamId]);

  if (!team) return null;

  const members = users.filter((u) => u.teamId === team.teamId);
  const others = users.filter((u) => u.teamId !== team.teamId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Members — {team.name}</DialogTitle>
          <DialogDescription>
            Adds users to this team in Dynamo and updates Cognito <code className="text-emerald-300">custom:teamId</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Add user to team</Label>
            <div className="flex gap-2">
              <select
                className={cn(selectCls, "flex-1")}
                value={pickUserId}
                onChange={(e) => setPickUserId(e.target.value)}
              >
                <option value="">Select user…</option>
                {others.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.displayName} ({u.role})
                    {u.teamId ? ` — currently on another team` : ""}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                disabled={!pickUserId}
                onClick={() => {
                  if (!pickUserId) return;
                  void onAssign(pickUserId, team.teamId);
                  setPickUserId("");
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Current members</p>
            {members.length === 0 ? (
              <p className="text-sm text-zinc-500">Nobody on this team yet.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {members.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 px-3 py-2 text-sm"
                  >
                    <span>
                      {m.displayName}
                      <span className="ml-2 text-xs text-zinc-500">{m.role}</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs text-zinc-400"
                      onClick={() => void onAssign(m.userId, "")}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
