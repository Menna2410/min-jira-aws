import type { Express } from "express";
import { Router } from "express";
import type { RouteCtx } from "./ctx.js";
import { mountApiRoutes } from "./api.js";

export type { RouteCtx };

export function mountRoutes(app: Express, ctx: RouteCtx) {
  const r = Router();
  r.get("/health", (_req, res) => res.json({ ok: true }));
  mountApiRoutes(r, ctx);
  app.use(r);
}
