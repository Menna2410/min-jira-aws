import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { AppConfig } from "../config.js";
import type { CommentRecord } from "../types/index.js";
import { commentFromItem, commentToItem } from "../lib/dynamoItemCodec.js";

export function commentsService(doc: DynamoDBDocumentClient, cfg: AppConfig) {
  const table = cfg.DYNAMO_TABLE_COMMENTS;
  const part = cfg.DYNAMO_ATTR_COMMENT_PARTITION;
  const sort = cfg.DYNAMO_ATTR_COMMENT_SORT;

  return {
    async create(input: Pick<CommentRecord, "taskId" | "authorUserId" | "body">): Promise<CommentRecord> {
      const commentId = crypto.randomUUID();
      const now = new Date().toISOString();
      const item: CommentRecord = { ...input, commentId, createdAt: now };
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: commentToItem(item, cfg),
          ConditionExpression: "attribute_not_exists(#p) AND attribute_not_exists(#s)",
          ExpressionAttributeNames: { "#p": part, "#s": sort },
        }),
      );
      return item;
    },

    async list(taskId: string): Promise<CommentRecord[]> {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "#p = :t",
          ExpressionAttributeNames: { "#p": part },
          ExpressionAttributeValues: { ":t": taskId },
        }),
      );
      const items = (res.Items ?? []) as Record<string, unknown>[];
      const parsed = items.map((raw) => commentFromItem(raw, cfg)).filter(Boolean) as CommentRecord[];
      parsed.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return parsed;
    },

    async deleteAllForTask(taskId: string): Promise<void> {
      const items = await this.list(taskId);
      for (const c of items) {
        await doc.send(
          new DeleteCommand({
            TableName: table,
            Key: { [part]: c.taskId, [sort]: c.commentId },
          }),
        );
      }
    },
  };
}
