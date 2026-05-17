import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from "@aws-sdk/client-cloudwatch";
import type { AppConfig } from "../config.js";

export function cloudWatchService(cfg: AppConfig) {
  const cw = new CloudWatchClient({ region: cfg.AWS_REGION });
  const namespace = cfg.CLOUDWATCH_NAMESPACE;

  return {
    async incrementTasksCreated(teamId: string) {
      await cw.send(
        new PutMetricDataCommand({
          Namespace: namespace,
          MetricData: [
            {
              MetricName: "TasksCreated",
              Unit: StandardUnit.Count,
              Value: 1,
              Timestamp: new Date(),
              Dimensions: [{ Name: "TeamId", Value: teamId }],
            },
          ],
        }),
      );
    },

    async incrementTasksClosed(teamId: string) {
      await cw.send(
        new PutMetricDataCommand({
          Namespace: namespace,
          MetricData: [
            {
              MetricName: "TasksClosed",
              Unit: StandardUnit.Count,
              Value: 1,
              Timestamp: new Date(),
              Dimensions: [{ Name: "TeamId", Value: teamId }],
            },
          ],
        }),
      );
    },

    async recordTimeToCloseMs(teamId: string, ms: number) {
      await cw.send(
        new PutMetricDataCommand({
          Namespace: namespace,
          MetricData: [
            {
              MetricName: "TaskTimeToCloseMs",
              Unit: StandardUnit.Milliseconds,
              Value: ms,
              Timestamp: new Date(),
              Dimensions: [{ Name: "TeamId", Value: teamId }],
            },
          ],
        }),
      );
    },
  };
}
