"use strict";

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { CloudWatchClient, PutMetricDataCommand, StandardUnit } = require("@aws-sdk/client-cloudwatch");
const crypto = require("crypto");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cw = new CloudWatchClient({});

const ACTIVITY_TABLE = process.env.ACTIVITY_TABLE_NAME;
const PK = process.env.ACTIVITY_PK_ATTR || "TaskID";
const SK = process.env.ACTIVITY_SK_ATTR || "ActivityID";
const CW_NAMESPACE = process.env.CLOUDWATCH_NAMESPACE || "MiniJira";

/** Unwrap SNS-in-SQS envelope (Subscribe with raw message delivery OFF). */
function parsePayload(bodyString) {
  const outer = JSON.parse(bodyString);
  if (outer.Type === "Notification" && typeof outer.Message === "string") {
    return JSON.parse(outer.Message);
  }
  return outer;
}

exports.handler = async (event) => {
  if (!ACTIVITY_TABLE) throw new Error("Missing ACTIVITY_TABLE_NAME");

  for (const rec of event.Records || []) {
    let payload;
    try {
      payload = parsePayload(rec.body);
    } catch (_e) {
      console.warn("Skipping non-JSON SQS record", rec.messageId);
      continue;
    }

    if (payload.type !== "TASK_ASSIGNED") {
      console.log("Skipping event type:", payload.type);
      continue;
    }

    const activityId = `asg#${Date.now()}#${crypto.randomUUID()}`;

    await ddb.send(
      new PutCommand({
        TableName: ACTIVITY_TABLE,
        Item: {
          [PK]: payload.taskId,
          [SK]: activityId,
          EventType: "TASK_ASSIGNED",
          TeamID: payload.teamId,
          ProjectID: payload.projectId,
          Title: payload.title,
          AssigneeUserId: payload.assigneeUserId,
          AssigneeEmail: payload.assigneeEmail,
          AssignedByUserId: payload.assignedByUserId,
          At: payload.at || new Date().toISOString(),
        },
      }),
    );

    await cw.send(
      new PutMetricDataCommand({
        Namespace: CW_NAMESPACE,
        MetricData: [
          {
            MetricName: "TasksAssignedPerTeam",
            Unit: StandardUnit.Count,
            Value: 1,
            Timestamp: new Date(),
            Dimensions: [{ Name: "TeamId", Value: payload.teamId }],
          },
        ],
      }),
    );

    console.log("Processed assignment:", payload.taskId, activityId);
  }
};
