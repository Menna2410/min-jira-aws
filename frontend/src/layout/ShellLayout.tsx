import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ChevronDown, LayoutDashboard, Layers, ShieldHalf } from "lucide-react";

import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isManagerLike } from "@/lib/rbac";

export function ShellLayout() {
  const navigate = useNavigate();
  const { me, initialized, signOut } = useAuth();

  async function logout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  if (!initialized || !me) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-zinc-900 px-8 py-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="w-full max-w-md space-y-3">
            <Skeleton className="h-40 w-full" />
            <p className="text-center text-sm text-zinc-500">
              Negotiating Dynamo plus Cognito context — standby for your claims.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-900/80 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => navigate("/board")}
              className="text-left font-semibold tracking-tight text-zinc-100"
            >
              Mini‑Jira<span className="text-emerald-400"> ●</span>
            </button>
            <nav className="hidden items-center gap-1 md:flex">
              <NavChip to="/board" icon={<LayoutDashboard className="size-4" />} label="Board" />
              {isManagerLike(me.role) ? (
                <NavChip to="/projects" icon={<Layers className="size-4" />} label="Projects" />
              ) : null}
              {me.role === "ADMIN" ? (
                <NavChip to="/admin/teams" icon={<ShieldHalf className="size-4" />} label="Teams" />
              ) : null}
            </nav>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <span className="max-w-[160px] truncate text-left text-xs sm:text-sm">{me.email}</span>
                <ChevronDown className="size-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <span className="text-xs uppercase text-zinc-500">Role</span>
                <p className="text-sm">{me.role}</p>
              </DropdownMenuLabel>
              {me.teamId ? (
                <>
                  <DropdownMenuLabel>
                    <span className="text-xs uppercase text-zinc-500">Team</span>
                    <p className="truncate font-mono text-xs">{me.teamId}</p>
                  </DropdownMenuLabel>
                </>
              ) : (
                <DropdownMenuLabel>No team binding</DropdownMenuLabel>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

function NavChip({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/board"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition",
          isActive ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
