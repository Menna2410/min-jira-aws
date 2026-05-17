import type { AppConfig } from "../config.js";
import type { cognitoAuthMiddleware } from "../middleware/cognitoAuth.js";
import type { teamsService } from "../services/teamsService.js";
import type { UsersServiceApi } from "../services/usersService.js";
import type { projectsService } from "../services/projectsService.js";
import type { tasksService } from "../services/tasksService.js";
import type { commentsService } from "../services/commentsService.js";
import type { auditService } from "../services/auditService.js";
import type { s3Service } from "../services/s3Service.js";

type Auth = ReturnType<typeof cognitoAuthMiddleware>;

export type RouteCtx = {
  cfg: AppConfig;
  auth: Auth;
  teams: ReturnType<typeof teamsService>;
  users: UsersServiceApi;
  projects: ReturnType<typeof projectsService>;
  tasks: ReturnType<typeof tasksService>;
  comments: ReturnType<typeof commentsService>;
  audits: ReturnType<typeof auditService>;
  s3: ReturnType<typeof s3Service>;
};
