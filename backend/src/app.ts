import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { AppConfig } from "./config.js";
import { createDocClient } from "./lib/dynamo.js";
import { createCognitoVerifier } from "./lib/cognitoVerifier.js";
import { cognitoAuthMiddleware, type AuthedRequest } from "./middleware/cognitoAuth.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { teamsService } from "./services/teamsService.js";
import { usersService } from "./services/usersService.js";
import { projectsService } from "./services/projectsService.js";
import { snsService } from "./services/snsService.js";
import { cloudWatchService } from "./services/cloudWatchService.js";
import { s3Service } from "./services/s3Service.js";
import { auditService } from "./services/auditService.js";
import { commentsService } from "./services/commentsService.js";
import { tasksService, type TasksDeps } from "./services/tasksService.js";
import { mountRoutes } from "./routes/index.js";

export function createApp(cfg: AppConfig) {
  const doc = createDocClient(cfg);
  const verifier = createCognitoVerifier(cfg);

  const teams = teamsService(doc, cfg);
  const users = usersService(doc, cfg);
  const projects = projectsService(doc, cfg);
  const sns = snsService(cfg);
  const cw = cloudWatchService(cfg);
  const s3 = s3Service(cfg);
  const audits = auditService(doc, cfg);
  const comments = commentsService(doc, cfg);

  const taskDeps: TasksDeps = { projects, sns, cw, audits, comments, users, s3 };
  const tasks = tasksService(doc, cfg, taskDeps);

  const auth = cognitoAuthMiddleware(verifier, users);

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  mountRoutes(app, {
    cfg,
    auth,
    teams,
    users,
    projects,
    tasks,
    comments,
    audits,
    s3,
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export type { AuthedRequest };
