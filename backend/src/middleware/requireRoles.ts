import type { Response, NextFunction } from "express";
import { HttpError } from "../errors/HttpError.js";
import type { Role } from "../types/index.js";
import { isManagerLike as isManagerLikeRole } from "../lib/rbac.js";
import type { AuthedRequest } from "./cognitoAuth.js";

export function requireRoles(...roles: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(new HttpError(401, "Unauthorized"));
    if (!roles.includes(user.role)) {
      return next(new HttpError(403, "Forbidden", { code: "FORBIDDEN_ROLE" }));
    }
    next();
  };
}

export function requireManagerLike() {
  return requireRoles("MANAGER", "ADMIN");
}

export function assertEmployeeHasTeam(user: { role: Role; teamId?: string }) {
  if (user.role !== "EMPLOYEE") return;
  if (!user.teamId) {
    throw new HttpError(403, "Employee account missing teamId attribute", { code: "MISSING_TEAM" });
  }
}

export function isManagerLike(role: Role) {
  return isManagerLikeRole(role);
}
