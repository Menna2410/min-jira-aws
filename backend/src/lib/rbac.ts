import type { Role } from "../types/index.js";

export function isManagerLike(role: Role) {
  return role === "MANAGER" || role === "ADMIN";
}
