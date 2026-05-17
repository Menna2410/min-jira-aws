import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HttpError } from "../errors/HttpError.js";
import type { AppConfig } from "../config.js";
import type { AuthUser, ProjectRecord } from "../types/index.js";
import { isManagerLike } from "../lib/rbac.js";
import { projectFromItem, projectToItem } from "../lib/dynamoItemCodec.js";

export function projectsService(doc: DynamoDBDocumentClient, cfg: AppConfig) {
  const table = cfg.DYNAMO_TABLE_PROJECTS;
  const teamGsi = cfg.PROJECTS_GSI_TEAM_ID;
  const pk = cfg.DYNAMO_ATTR_PROJECT_ID;
  const teamAttr = cfg.DYNAMO_ATTR_PROJECT_TEAM_ID;

  return {
    assertReadableBy(user: AuthUser, project: ProjectRecord) {
      if (isManagerLike(user.role)) return;
      if (user.role === "EMPLOYEE") {
        if (!user.teamId || user.teamId !== project.teamId) {
          throw new HttpError(404, "Project not found");
        }
      }
    },

    async create(input: Pick<ProjectRecord, "name" | "teamId"> & { description?: string; createdByUserId: string }): Promise<ProjectRecord> {
      const projectId = crypto.randomUUID();
      const now = new Date().toISOString();
      const item: ProjectRecord = {
        projectId,
        name: input.name,
        description: input.description,
        teamId: input.teamId,
        createdByUserId: input.createdByUserId,
        createdAt: now,
        updatedAt: now,
      };
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: projectToItem(item, cfg),
          ConditionExpression: "attribute_not_exists(#pk)",
          ExpressionAttributeNames: { "#pk": pk },
        }),
      );
      return item;
    },

    async get(projectId: string): Promise<ProjectRecord | undefined> {
      const res = await doc.send(new GetCommand({ TableName: table, Key: { [pk]: projectId } }));
      return projectFromItem(res.Item as Record<string, unknown> | undefined, cfg);
    },

    async getOrThrow(projectId: string): Promise<ProjectRecord> {
      const p = await this.get(projectId);
      if (!p) throw new HttpError(404, "Project not found");
      return p;
    },

    async listForUser(user: AuthUser): Promise<ProjectRecord[]> {
      if (isManagerLike(user.role)) {
        const out: ProjectRecord[] = [];
        let startKey: Record<string, unknown> | undefined;
        do {
          const res = await doc.send(new ScanCommand({ TableName: table, ExclusiveStartKey: startKey }));
          const items = (res.Items ?? []) as Record<string, unknown>[];
          for (const raw of items) {
            const p = projectFromItem(raw, cfg);
            if (p) out.push(p);
          }
          startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
        } while (startKey);
        return out;
      }

      if (user.role === "EMPLOYEE") {
        if (!user.teamId) throw new HttpError(403, "Employee account missing teamId");
        const out: ProjectRecord[] = [];
        let startKey: Record<string, unknown> | undefined;
        do {
          const res = await doc.send(
            new QueryCommand({
              TableName: table,
              IndexName: teamGsi,
              KeyConditionExpression: "#t = :t",
              ExpressionAttributeNames: { "#t": teamAttr },
              ExpressionAttributeValues: { ":t": user.teamId },
              ExclusiveStartKey: startKey,
            }),
          );
          const items = (res.Items ?? []) as Record<string, unknown>[];
          for (const raw of items) {
            const p = projectFromItem(raw, cfg);
            if (p) out.push(p);
          }
          startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
        } while (startKey);
        return out;
      }

      return [];
    },

    async update(projectId: string, patch: Partial<Pick<ProjectRecord, "name" | "description" | "teamId">>): Promise<ProjectRecord> {
      const now = new Date().toISOString();
      const names: Record<string, string> = { "#u": "updatedAt", "#pk": pk };
      const values: Record<string, unknown> = { ":u": now };
      const sets: string[] = ["#u = :u"];

      if (patch.name !== undefined) {
        names["#n"] = "name";
        values[":n"] = patch.name;
        sets.push("#n = :n");
      }
      if (patch.description !== undefined) {
        names["#d"] = "description";
        values[":d"] = patch.description;
        sets.push("#d = :d");
      }
      if (patch.teamId !== undefined) {
        names["#tid"] = teamAttr;
        values[":tid"] = patch.teamId;
        sets.push("#tid = :tid");
      }

      const res = await doc.send(
        new UpdateCommand({
          TableName: table,
          Key: { [pk]: projectId },
          UpdateExpression: `SET ${sets.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ConditionExpression: "attribute_exists(#pk)",
          ReturnValues: "ALL_NEW",
        }),
      );
      return projectFromItem(res.Attributes as Record<string, unknown>, cfg)!;
    },

    async delete(projectId: string): Promise<void> {
      await doc.send(
        new DeleteCommand({
          TableName: table,
          Key: { [pk]: projectId },
          ConditionExpression: "attribute_exists(#pk)",
          ExpressionAttributeNames: { "#pk": pk },
        }),
      );
    },
  };
}
