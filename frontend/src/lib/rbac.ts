import type { Role } from "@/api/types";

export function isManagerLike(role: Role) {
  return role === "MANAGER" || role === "ADMIN";
}
