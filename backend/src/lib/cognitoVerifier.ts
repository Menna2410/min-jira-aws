import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { AppConfig } from "../config.js";
import type { AuthUser, Role } from "../types/index.js";

function readRole(payload: Record<string, unknown>): Role {
  const custom = payload["custom:role"];
  const role = payload["role"];
  const raw =
    (typeof custom === "string" ? custom : undefined) ?? (typeof role === "string" ? role : undefined);
  const upper = raw?.toUpperCase();
  if (upper === "MANAGER" || upper === "EMPLOYEE" || upper === "ADMIN") return upper;
  throw new Error("Missing or invalid role claim");
}

function readTeamId(payload: Record<string, unknown>): string | undefined {
  const v = payload["custom:teamId"];
  if (typeof v !== "string" || !v.trim()) return undefined;
  return v.trim();
}

export function createCognitoVerifier(cfg: AppConfig) {
  if (!cfg.COGNITO_CLIENT_ID) {
    throw new Error("COGNITO_CLIENT_ID is required to validate Cognito ID tokens");
  }

  const verifier = CognitoJwtVerifier.create({
    userPoolId: cfg.COGNITO_USER_POOL_ID,
    tokenUse: "id",
    clientId: cfg.COGNITO_CLIENT_ID,
  });

  return {
    async verifyAuthorizationHeader(authHeader: string | undefined): Promise<AuthUser> {
      if (!authHeader?.startsWith("Bearer ")) {
        throw new Error("Missing bearer token");
      }
      const token = authHeader.slice("Bearer ".length).trim();
      const payload = (await verifier.verify(token)) as Record<string, unknown>;
      const sub = payload.sub as string | undefined;
      const email = (payload.email as string | undefined) ?? (payload.username as string | undefined);
      if (!sub) throw new Error("Missing sub claim");
      if (!email) throw new Error("Missing email/username claim");

      return {
        userId: sub,
        email,
        role: readRole(payload),
        teamId: readTeamId(payload),
      };
    },
  };
}

export type CognitoVerifier = ReturnType<typeof createCognitoVerifier>;