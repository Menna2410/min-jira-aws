import {
  AdminDeleteUserAttributesCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

import { HttpError } from "../errors/HttpError.js";
import type { AppConfig } from "../config.js";
import type { UserRecord } from "../types/index.js";

export function cognitoAdminService(cfg: AppConfig) {
  const client = new CognitoIdentityProviderClient({ region: cfg.AWS_REGION });
  const userPoolId = cfg.COGNITO_USER_POOL_ID;

  return {
    async syncUserTeamId(user: Pick<UserRecord, "userId" | "email">, teamId: string | undefined) {
      const candidates = [user.email, user.userId].filter(
        (v, i, arr) => typeof v === "string" && v.trim() && arr.indexOf(v) === i,
      );

      let lastErr: unknown;
      for (const username of candidates) {
        try {
          if (teamId) {
            await client.send(
              new AdminUpdateUserAttributesCommand({
                UserPoolId: userPoolId,
                Username: username,
                UserAttributes: [{ Name: "custom:teamId", Value: teamId }],
              }),
            );
          } else {
            await client.send(
              new AdminDeleteUserAttributesCommand({
                UserPoolId: userPoolId,
                Username: username,
                UserAttributeNames: ["custom:teamId"],
              }),
            );
          }
          return;
        } catch (e) {
          lastErr = e;
        }
      }

      const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
      throw new HttpError(
        502,
        `Updated Dynamo but Cognito custom:teamId failed — ensure the API role can cognito-idp:AdminUpdateUserAttributes. ${detail}`,
      );
    },
  };
}

export type CognitoAdminApi = ReturnType<typeof cognitoAdminService>;
