import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand, QueryCommand, ScanCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HttpError } from "../errors/HttpError.js";
import type { AppConfig } from "../config.js";
import type { TeamRecord } from "../types/index.js";
import { teamFromItem, teamToItem } from "../lib/dynamoItemCodec.js";

export type TeamsApi = ReturnType<typeof teamsService>;

export function teamsService(doc: DynamoDBDocumentClient, cfg: AppConfig) {
  const table = cfg.DYNAMO_TABLE_TEAMS;
  const pk = cfg.DYNAMO_ATTR_TEAM_ID;

  return {
    async create(input: Pick<TeamRecord, "name"> & { description?: string }): Promise<TeamRecord> {
      const teamId = crypto.randomUUID();
      const now = new Date().toISOString();
      const item: TeamRecord = {
        teamId,
        name: input.name,
        description: input.description,
        createdAt: now,
        updatedAt: now,
      };
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: teamToItem(item, cfg),
          ConditionExpression: "attribute_not_exists(#pk)",
          ExpressionAttributeNames: { "#pk": pk },
        }),
      );
      return item;
    },

    async get(teamId: string): Promise<TeamRecord | undefined> {
      const res = await doc.send(new GetCommand({ TableName: table, Key: { [pk]: teamId } }));
      return teamFromItem(res.Item as Record<string, unknown> | undefined, cfg);
    },

    async getOrThrow(teamId: string): Promise<TeamRecord> {
      const t = await this.get(teamId);
      if (!t) throw new HttpError(404, "Team not found");
      return t;
    },

    async list(): Promise<TeamRecord[]> {
      const res = await doc.send(new ScanCommand({ TableName: table }));
      const items = (res.Items ?? []) as Record<string, unknown>[];
      return items.map((raw) => teamFromItem(raw, cfg)).filter(Boolean) as TeamRecord[];
    },

    async update(teamId: string, patch: Partial<Pick<TeamRecord, "name" | "description">>): Promise<TeamRecord> {
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

      const res = await doc.send(
        new UpdateCommand({
          TableName: table,
          Key: { [pk]: teamId },
          UpdateExpression: `SET ${sets.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ConditionExpression: "attribute_exists(#pk)",
          ReturnValues: "ALL_NEW",
        }),
      );
      return teamFromItem(res.Attributes as Record<string, unknown>, cfg)!;
    },

    async delete(teamId: string): Promise<void> {
      await doc.send(
        new DeleteCommand({
          TableName: table,
          Key: { [pk]: teamId },
          ConditionExpression: "attribute_exists(#pk)",
          ExpressionAttributeNames: { "#pk": pk },
        }),
      );
    },
  };
}
