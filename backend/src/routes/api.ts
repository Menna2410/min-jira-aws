import type { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/cognitoAuth.js";
import { requireManagerLike, requireRoles } from "../middleware/requireRoles.js";
import { HttpError } from "../errors/HttpError.js";
import type { RouteCtx } from "./ctx.js";

const TaskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
const TaskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

/** Express 5 types path params as `string | string[]` for some route shapes. */
function routeParam(param: string | string[] | undefined): string {
  const v = Array.isArray(param) ? param[0] : param;
  if (typeof v !== "string" || !v) throw new HttpError(400, "Invalid route parameter");
  return v;
}

export function mountApiRoutes(r: Router, ctx: RouteCtx) {
  r.use("/api", ctx.auth);

  r.get("/api/me", (req: AuthedRequest, res) => res.json({ user: req.user }));

  mountTeams(r, ctx);
  mountUsers(r, ctx);
  mountProjects(r, ctx);
  mountTasks(r, ctx);
}

function mountTeams(r: Router, ctx: RouteCtx) {
  r.get("/api/teams", async (_req: AuthedRequest, res) => res.json({ teams: await ctx.teams.list() }));

  r.post("/api/teams", requireRoles("ADMIN"), async (req: AuthedRequest, res) => {
    const body = z.object({ name: z.string().min(1), description: z.string().optional() }).parse(req.body);
    const team = await ctx.teams.create(body);
    return res.status(201).json({ team });
  });

  r.patch("/api/teams/:teamId", requireRoles("ADMIN"), async (req: AuthedRequest, res) => {
    const body = z.object({ name: z.string().min(1).optional(), description: z.string().optional() }).parse(req.body);
    const team = await ctx.teams.update(routeParam(req.params.teamId), body);
    return res.json({ team });
  });

  r.delete("/api/teams/:teamId", requireRoles("ADMIN"), async (req: AuthedRequest, res) => {
    await ctx.teams.delete(routeParam(req.params.teamId));
    return res.status(204).send();
  });
}

function mountUsers(r: Router, ctx: RouteCtx) {
  r.get("/api/users", requireManagerLike(), async (_req: AuthedRequest, res) => {
    return res.json({ users: await ctx.users.listAssignable() });
  });
}

function mountProjects(r: Router, ctx: RouteCtx) {
  r.get("/api/projects", async (req: AuthedRequest, res) => {
    return res.json({ projects: await ctx.projects.listForUser(req.user!) });
  });

  r.post("/api/projects", requireManagerLike(), async (req: AuthedRequest, res) => {
    const body = z
      .object({ name: z.string().min(1), description: z.string().optional(), teamId: z.string().min(1) })
      .parse(req.body);
    const project = await ctx.projects.create({ ...body, createdByUserId: req.user!.userId });
    return res.status(201).json({ project });
  });

  r.get("/api/projects/:projectId", async (req: AuthedRequest, res) => {
    const project = await ctx.projects.getOrThrow(routeParam(req.params.projectId));
    ctx.projects.assertReadableBy(req.user!, project);
    return res.json({ project });
  });

  r.patch("/api/projects/:projectId", requireManagerLike(), async (req: AuthedRequest, res) => {
    const body = z
      .object({ name: z.string().min(1).optional(), description: z.string().optional(), teamId: z.string().min(1).optional() })
      .parse(req.body);
    const project = await ctx.projects.update(routeParam(req.params.projectId), body);
    return res.json({ project });
  });

  r.delete("/api/projects/:projectId", requireManagerLike(), async (req: AuthedRequest, res) => {
    await ctx.projects.delete(routeParam(req.params.projectId));
    return res.status(204).send();
  });
}

function mountTasks(r: Router, ctx: RouteCtx) {
  r.get("/api/tasks", async (req: AuthedRequest, res) => {
    const q = z.object({ teamId: z.string().optional() }).parse(req.query);
    if (q.teamId && req.user!.role === "EMPLOYEE") {
      throw new HttpError(400, "teamId filter is not allowed for employees");
    }
    return res.json({ tasks: await ctx.tasks.listForUser(req.user!, { teamId: q.teamId }) });
  });

  r.post("/api/tasks", requireManagerLike(), async (req: AuthedRequest, res) => {
    const body = z
      .object({
        projectId: z.string().min(1),
        teamId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().default(""),
        status: TaskStatusSchema.default("TODO"),
        priority: TaskPrioritySchema.default("MEDIUM"),
        deadline: z.string().min(1),
        assigneeUserId: z.string().min(1),
        imageCurrentKey: z.string().optional(),
      })
      .parse(req.body);

    const task = await ctx.tasks.create(req.user!, { ...body, createdByUserId: req.user!.userId });
    return res.status(201).json({ task });
  });

  r.get("/api/tasks/:taskId", async (req: AuthedRequest, res) => {
    return res.json({ task: await ctx.tasks.getForUser(req.user!, routeParam(req.params.taskId)) });
  });

  r.patch("/api/tasks/:taskId", async (req: AuthedRequest, res) => {
    const body = z
      .object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: TaskPrioritySchema.optional(),
        deadline: z.string().optional(),
        assigneeUserId: z.string().optional(),
        teamId: z.string().optional(),
        projectId: z.string().optional(),
        status: TaskStatusSchema.optional(),
        imageCurrentKey: z.string().optional(),
      })
      .parse(req.body);

    return res.json({ task: await ctx.tasks.update(req.user!, routeParam(req.params.taskId), body) });
  });

  r.delete("/api/tasks/:taskId", requireManagerLike(), async (req: AuthedRequest, res) => {
    await ctx.tasks.delete(req.user!, routeParam(req.params.taskId));
    return res.status(204).send();
  });

  r.get("/api/tasks/:taskId/audit", async (req: AuthedRequest, res) => {
    const taskId = routeParam(req.params.taskId);
    await ctx.tasks.getForUser(req.user!, taskId);
    return res.json({ audit: await ctx.audits.listForTask(taskId) });
  });

  r.get("/api/tasks/:taskId/comments", async (req: AuthedRequest, res) => {
    const taskId = routeParam(req.params.taskId);
    await ctx.tasks.getForUser(req.user!, taskId);
    return res.json({ comments: await ctx.comments.list(taskId) });
  });

  r.post("/api/tasks/:taskId/comments", async (req: AuthedRequest, res) => {
    const taskId = routeParam(req.params.taskId);
    await ctx.tasks.getForUser(req.user!, taskId);
    const body = z.object({ body: z.string().min(1) }).parse(req.body);
    const comment = await ctx.comments.create({
      taskId,
      authorUserId: req.user!.userId,
      body: body.body,
    });
    return res.status(201).json({ comment });
  });

  r.post("/api/tasks/:taskId/attachments/presign", async (req: AuthedRequest, res) => {
    const task = await ctx.tasks.getForUser(req.user!, routeParam(req.params.taskId));
    if (req.user!.role === "EMPLOYEE" && task.assigneeUserId !== req.user!.userId) {
      throw new HttpError(403, "Only the assignee can upload attachments for this task");
    }

    const body = z
      .object({
        contentType: z.string().min(1).default("application/octet-stream"),
        ext: z.string().min(1).max(16).default("jpg"),
      })
      .parse(req.body);

    const key = ctx.s3.taskAttachmentKey(task.taskId, crypto.randomUUID(), body.ext);
    const presigned = await ctx.s3.presignPut(key, body.contentType);
    return res.status(201).json({ presigned, key });
  });

  r.post("/api/tasks/:taskId/attachments/commit", async (req: AuthedRequest, res) => {
    const task = await ctx.tasks.getForUser(req.user!, routeParam(req.params.taskId));
    if (req.user!.role === "EMPLOYEE" && task.assigneeUserId !== req.user!.userId) {
      throw new HttpError(403, "Only the assignee can upload attachments for this task");
    }
    const body = z.object({ key: z.string().min(1) }).parse(req.body);
    const prefix = `tasks/${task.taskId}/`;
    if (!body.key.startsWith(prefix)) {
      throw new HttpError(400, "Invalid attachment key for this task");
    }
    const updated = await ctx.tasks.commitImageUpload(req.user!, task.taskId, body.key);
    return res.json({ task: updated });
  });

  r.get("/api/tasks/:taskId/attachments/url", async (req: AuthedRequest, res) => {
    const task = await ctx.tasks.getForUser(req.user!, routeParam(req.params.taskId));
    const q = z.object({ key: z.string().optional() }).parse(req.query);
    const key = q.key ?? task.imageCurrentKey;
    if (!key) {
      throw new HttpError(404, "No attachment for this task");
    }
    const prefix = `tasks/${task.taskId}/`;
    if (!key.startsWith(prefix)) {
      throw new HttpError(400, "Invalid attachment key for this task");
    }
    const presigned = await ctx.s3.presignGet(key);
    return res.json({ presigned });
  });
}
