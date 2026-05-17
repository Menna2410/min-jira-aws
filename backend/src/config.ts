import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  AWS_REGION: z.string().min(1),

  COGNITO_USER_POOL_ID: z.string().min(1),
  COGNITO_CLIENT_ID: z.string().min(1),

  DYNAMO_TABLE_TEAMS: z.string().min(1),
  DYNAMO_TABLE_USERS: z.string().min(1),
  DYNAMO_TABLE_PROJECTS: z.string().min(1),
  PROJECTS_GSI_TEAM_ID: z.string().min(1).default("GSI_TeamId"),
  DYNAMO_TABLE_TASKS: z.string().min(1),
  DYNAMO_TABLE_COMMENTS: z.string().min(1),
  DYNAMO_TABLE_TASK_AUDIT: z.string().min(1),

  TASKS_GSI_TEAM_ID: z.string().min(1),
  TASKS_GSI_ASSIGNEE_ID: z.string().min(1),

  /** DynamoDB attribute names — must match table + index key schemas in AWS. */
  DYNAMO_ATTR_TEAM_ID: z.string().default("TeamID"),
  DYNAMO_ATTR_USER_ID: z.string().default("UserID"),
  /** Team membership on user items (non-key). */
  DYNAMO_ATTR_USER_TEAM_ID: z.string().default("TeamID"),
  DYNAMO_ATTR_PROJECT_ID: z.string().default("ProjectID"),
  /** Team id on project items; must match Projects GSI partition key attribute. */
  DYNAMO_ATTR_PROJECT_TEAM_ID: z.string().default("TeamID"),
  DYNAMO_ATTR_TASK_ID: z.string().default("TaskID"),
  /** On task items; must match Tasks-by-team GSI partition key attribute. */
  DYNAMO_ATTR_TASK_TEAM_ID: z.string().default("TeamID"),
  /** On task items; must match Tasks-by-assignee GSI partition key attribute. */
  DYNAMO_ATTR_TASK_ASSIGNEE_ID: z.string().default("AssigneeUserId"),

  /** Comments table: partition key (task id). Sort key = CommentID. */
  DYNAMO_ATTR_COMMENT_PARTITION: z.string().default("TaskID"),
  DYNAMO_ATTR_COMMENT_SORT: z.string().default("CommentID"),

  /** TaskAudit table: partition key (task id). Sort key = AuditID. */
  DYNAMO_ATTR_AUDIT_PARTITION: z.string().default("TaskID"),
  DYNAMO_ATTR_AUDIT_SORT: z.string().default("AuditID"),

  S3_ORIGINALS_BUCKET: z.string().min(1),
  S3_UPLOAD_URL_TTL_SECONDS: z.coerce.number().default(3600),

  SNS_TASK_ASSIGNED_TOPIC_ARN: z.string().min(1),

  CLOUDWATCH_NAMESPACE: z.string().min(1).default("MiniJira"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  return parsed.data;
}
