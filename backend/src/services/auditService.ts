import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { AppConfig } from "../config.js";
import type { TaskAuditRecord, TaskStatus } from "../types/index.js";
import { auditFromItem, auditToItem } from "../lib/dynamoItemCodec.js";

export function auditService(doc: DynamoDBDocumentClient, cfg: AppConfig) {
  const table = cfg.DYNAMO_TABLE_TASK_AUDIT;
  const part = cfg.DYNAMO_ATTR_AUDIT_PARTITION;
  const sort = cfg.DYNAMO_ATTR_AUDIT_SORT;

  return {
    async record(args: {
      taskId: string;
      actorUserId: string;
      fromStatus: TaskStatus | null;
      toStatus: TaskStatus;
    }) {
      const auditId = `${Date.now().toString(36)}#${crypto.randomUUID()}`;
      const item: TaskAuditRecord = {
        taskId: args.taskId,
        auditId,
        actorUserId: args.actorUserId,
        fromStatus: args.fromStatus,
        toStatus: args.toStatus,
        at: new Date().toISOString(),
      };
      await doc.send(new PutCommand({ TableName: table, Item: auditToItem(item, cfg) }));
      return item;
    },

    async listForTask(taskId: string): Promise<TaskAuditRecord[]> {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "#p = :t",
          ExpressionAttributeNames: { "#p": part },
          ExpressionAttributeValues: { ":t": taskId },
        }),
      );
      const items = (res.Items ?? []) as Record<string, unknown>[];
      const parsed = items.map((raw) => auditFromItem(raw, cfg)).filter(Boolean) as TaskAuditRecord[];
      parsed.sort((a, b) => a.at.localeCompare(b.at));
      return parsed;
    },
  };
}
