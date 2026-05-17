import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors/HttpError.js";
import type { AuthUser } from "../types/index.js";
import type { CognitoVerifier } from "../lib/cognitoVerifier.js";
import type { UsersServiceApi } from "../services/usersService.js";

export type AuthedRequest = Request & { user?: AuthUser };

export function cognitoAuthMiddleware(verifier: CognitoVerifier, users: UsersServiceApi) {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    try {
      const user = await verifier.verifyAuthorizationHeader(req.header("authorization"));
      await users.upsertFromAuthUser(user);
      req.user = user;
      next();
    } catch (e) {
      next(new HttpError(401, "Unauthorized", { code: "UNAUTHORIZED", details: String(e) }));
    }
  };
}
