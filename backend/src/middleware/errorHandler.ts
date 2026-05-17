import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors/HttpError.js";
import type { AuthedRequest } from "./cognitoAuth.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

export function notFoundHandler(req: AuthedRequest, res: Response) {
  return res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}
