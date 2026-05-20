import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import type { AppConfig } from "../config.js";

export type TaskAssignedEvent = {
  type: "TASK_ASSIGNED";
  taskId: string;
  projectId: string;
  teamId: string;
  title: string;
  assigneeUserId: string;
  assigneeEmail: string;
  assignedByUserId: string;
  at: string;
};

export function snsService(cfg: AppConfig) {
  const sns = new SNSClient({ region: cfg.AWS_REGION });
  const topicArn = cfg.SNS_TASK_ASSIGNED_TOPIC_ARN;

  return {
    async publishTaskAssigned(event: TaskAssignedEvent) {
      const message = JSON.stringify(event);
      await sns.send(
        new PublishCommand({
          TopicArn: topicArn,
          Subject: `New task assigned: ${event.title}`,
          Message: message,
          MessageAttributes: {
            type: { DataType: "String", StringValue: event.type },
            AssigneeEmail: { DataType: "String", StringValue: event.assigneeEmail },
          },
        }),
      );
    },
  };
}
