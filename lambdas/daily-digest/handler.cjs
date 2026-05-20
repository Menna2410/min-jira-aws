"use strict";

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({});

const TASKS_TABLE = process.env.TASKS_TABLE_NAME;
const USERS_TABLE = process.env.USERS_TABLE_NAME;
const SNS_TOPIC_ARN = process.env.SNS_DIGEST_TOPIC_ARN;
const TIMEZONE = process.env.DIGEST_TIMEZONE || "Africa/Cairo";

const TASK_PK = process.env.TASK_PK_ATTR || "TaskID";
const USER_PK = process.env.USER_PK_ATTR || "UserID";
const ASSIGNEE_ATTR = process.env.TASK_ASSIGNEE_ATTR || "AssigneeUserId";

function requireEnv() {
  const missing = [];
  if (!TASKS_TABLE) missing.push("TASKS_TABLE_NAME");
  if (!USERS_TABLE) missing.push("USERS_TABLE_NAME");
  if (!SNS_TOPIC_ARN) missing.push("SNS_DIGEST_TOPIC_ARN");
  if (missing.length) throw new Error(`Missing ${missing.join(", ")}`);
}

/** YYYY-MM-DD in the configured timezone (matches task deadline calendar day). */
function dateKey(isoOrMs, timeZone) {
  const d = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function scanAllTasks() {
  const items = [];
  let lastKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TASKS_TABLE,
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function getUserEmail(userId) {
  const res = await ddb.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { [USER_PK]: userId },
    }),
  );
  const item = res.Item;
  if (!item) return null;
  const email = typeof item.email === "string" ? item.email.trim() : "";
  const displayName = typeof item.displayName === "string" ? item.displayName.trim() : "";
  if (!email) return null;
  return { email, displayName: displayName || email };
}

function formatTaskLine(task) {
  const title = typeof task.title === "string" ? task.title : "(untitled)";
  const status = typeof task.status === "string" ? task.status : "?";
  const priority = typeof task.priority === "string" ? task.priority : "?";
  const taskId = task[TASK_PK] ?? task.TaskID ?? task.taskId ?? "?";
  return `- [${priority}] ${title} (${status}) — id ${taskId}`;
}

function buildDigestBody(tasks, todayLabel) {
  const lines = [`Tasks due today (${todayLabel}):`, ""];
  for (const t of tasks) lines.push(formatTaskLine(t));
  lines.push("", `${tasks.length} task(s) due. Open Mini-Jira to update status.`);
  return lines.join("\n");
}

exports.handler = async () => {
  requireEnv();

  const todayKey = dateKey(Date.now(), TIMEZONE);
  console.log("Daily digest run for date:", todayKey, "timezone:", TIMEZONE);

  const allTasks = await scanAllTasks();
  const dueToday = allTasks.filter((task) => {
    const deadline = task.deadline;
    if (typeof deadline !== "string" || !deadline) return false;
    if (task.status === "DONE") return false;
    return dateKey(deadline, TIMEZONE) === todayKey;
  });

  console.log("Scanned tasks:", allTasks.length, "due today:", dueToday.length);

  if (dueToday.length === 0) {
    console.log("No tasks due today — no emails sent.");
    return { sent: 0, dueToday: 0 };
  }

  /** @type {Map<string, object[]>} */
  const byAssignee = new Map();
  for (const task of dueToday) {
    const assigneeId = task[ASSIGNEE_ATTR];
    if (typeof assigneeId !== "string" || !assigneeId) continue;
    if (!byAssignee.has(assigneeId)) byAssignee.set(assigneeId, []);
    byAssignee.get(assigneeId).push(task);
  }

  let sent = 0;
  for (const [assigneeId, tasks] of byAssignee) {
    const user = await getUserEmail(assigneeId);
    if (!user) {
      console.warn("No email for assignee", assigneeId, "— skipping");
      continue;
    }

    const subject = `Mini-Jira daily digest: ${tasks.length} task(s) due today`;
    const message = buildDigestBody(tasks, todayKey);

    await sns.send(
      new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: subject.slice(0, 100),
        Message: message,
        MessageAttributes: {
          assigneeUserId: { DataType: "String", StringValue: assigneeId },
          assigneeEmail: { DataType: "String", StringValue: user.email },
        },
      }),
    );

    console.log("Sent digest to", user.email, "tasks:", tasks.length);
    sent += 1;
  }

  return { sent, dueToday: dueToday.length, assignees: byAssignee.size };
};
