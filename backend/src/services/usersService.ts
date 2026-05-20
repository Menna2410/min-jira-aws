import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { HttpError } from "../errors/HttpError.js";

import type { AppConfig } from "../config.js";

import type { AuthUser, UserRecord, Role } from "../types/index.js";

import { userFromItem, userToItem } from "../lib/dynamoItemCodec.js";

import type { CognitoAdminApi } from "./cognitoAdmin.js";



export function usersService(doc: DynamoDBDocumentClient, cfg: AppConfig, cognito?: CognitoAdminApi) {

  const table = cfg.DYNAMO_TABLE_USERS;

  const pk = cfg.DYNAMO_ATTR_USER_ID;



  return {

    async upsertFromAuthUser(user: AuthUser): Promise<UserRecord> {

      const now = new Date().toISOString();

      const existing = await doc.send(new GetCommand({ TableName: table, Key: { [pk]: user.userId } }));

      const prev = userFromItem(existing.Item as Record<string, unknown> | undefined, cfg);



      const item: UserRecord = {

        userId: user.userId,

        email: user.email,

        displayName: prev?.displayName ?? user.email.split("@")[0] ?? user.email,

        role: user.role,

        teamId: user.teamId,

        createdAt: prev?.createdAt ?? now,

        updatedAt: now,

      };



      await doc.send(new PutCommand({ TableName: table, Item: userToItem(item, cfg) }));

      return item;

    },



    async get(userId: string): Promise<UserRecord | undefined> {

      const res = await doc.send(new GetCommand({ TableName: table, Key: { [pk]: userId } }));

      return userFromItem(res.Item as Record<string, unknown> | undefined, cfg);

    },



    async listAssignable(): Promise<UserRecord[]> {

      const res = await doc.send(new ScanCommand({ TableName: table }));

      const items = (res.Items ?? []) as Record<string, unknown>[];

      return items.map((raw) => userFromItem(raw, cfg)).filter(Boolean) as UserRecord[];

    },



    /**

     * Optional: Admin tool to attach a user to a team (updates Dynamo; Cognito attributes must be updated separately).

     */

    async adminSetUserTeam(
      userId: string,
      teamId: string | undefined,
      role?: Role,
    ): Promise<UserRecord> {

      const now = new Date().toISOString();

      const existing = await doc.send(new GetCommand({ TableName: table, Key: { [pk]: userId } }));

      const prev = userFromItem(existing.Item as Record<string, unknown> | undefined, cfg);

      if (!prev) {

        throw new HttpError(404, "User profile not found");

      }

      const item: UserRecord = {

        ...prev,

        teamId,

        role: role ?? prev.role,

        updatedAt: now,

      };

      await doc.send(new PutCommand({ TableName: table, Item: userToItem(item, cfg) }));

      if (cognito) {
        await cognito.syncUserTeamId(item, teamId);
      }

      return item;

    },

  };

}

export type UsersServiceApi = ReturnType<typeof usersService>;
