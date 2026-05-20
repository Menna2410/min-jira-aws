import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { HttpError } from "../errors/HttpError.js";

import type { AppConfig } from "../config.js";

import type { AuthUser, TaskImageVersion, TaskPriority, TaskRecord, TaskStatus } from "../types/index.js";

import { TaskStatuses } from "../types/index.js";

import { isManagerLike } from "../lib/rbac.js";

import type { projectsService } from "./projectsService.js";

import type { snsService } from "./snsService.js";

import type { cloudWatchService } from "./cloudWatchService.js";

import type { auditService } from "./auditService.js";

import type { commentsService } from "./commentsService.js";

import type { UsersServiceApi } from "./usersService.js";

import type { s3Service } from "./s3Service.js";

import { taskFromItem, taskToItem } from "../lib/dynamoItemCodec.js";



type Projects = ReturnType<typeof projectsService>;

type SNS = ReturnType<typeof snsService>;

type CW = ReturnType<typeof cloudWatchService>;

type Audits = ReturnType<typeof auditService>;

type Comments = ReturnType<typeof commentsService>;

type Users = UsersServiceApi;

type S3 = ReturnType<typeof s3Service>;



export type TasksDeps = {

  projects: Projects;

  sns: SNS;

  cw: CW;

  audits: Audits;

  comments: Comments;

  users: Users;

  s3: S3;

};



function assertValidStatus(value: string): asserts value is TaskStatus {

  if (!TaskStatuses.includes(value as TaskStatus)) {

    throw new HttpError(400, "Invalid status");

  }

}



function forwardAllowed(from: TaskStatus, to: TaskStatus) {

  if (from === to) return true;

  const order: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

  const i = order.indexOf(from);

  const j = order.indexOf(to);

  if (i < 0 || j < 0) return false;

  return j === i + 1;

}



type TaskDef = TaskRecord;



export function tasksService(doc: DynamoDBDocumentClient, cfg: AppConfig, deps: TasksDeps) {

  const table = cfg.DYNAMO_TABLE_TASKS;

  const gsiTeam = cfg.TASKS_GSI_TEAM_ID;

  const gsiAssignee = cfg.TASKS_GSI_ASSIGNEE_ID;

  const pk = cfg.DYNAMO_ATTR_TASK_ID;

  const teamAttr = cfg.DYNAMO_ATTR_TASK_TEAM_ID;

  const assigneeAttr = cfg.DYNAMO_ATTR_TASK_ASSIGNEE_ID;

  const auditPk = cfg.DYNAMO_ATTR_AUDIT_PARTITION;

  const auditSk = cfg.DYNAMO_ATTR_AUDIT_SORT;



  const assertVisible = (user: AuthUser, task: TaskDef) => {

    if (isManagerLike(user.role)) return;

    if (user.role === "EMPLOYEE") {

      if (!user.teamId) {

        throw new HttpError(403, "Employee account missing teamId");

      }

      if (task.teamId !== user.teamId) {

        throw new HttpError(404, "Task not found");

      }

    }

  };



  async function publishAssignedIfNeeded(task: TaskDef, assignedByUserId: string) {

    const assignee = await deps.users.get(task.assigneeUserId);

    if (!assignee?.email) return;

    await deps.sns.publishTaskAssigned({

      type: "TASK_ASSIGNED",

      taskId: task.taskId,

      projectId: task.projectId,

      teamId: task.teamId,

      title: task.title,

      assigneeUserId: task.assigneeUserId,

      assigneeEmail: assignee.email,

      assignedByUserId,

      at: new Date().toISOString(),

    });

  }



  return {

    assertVisible,



    async getOrThrow(taskId: string): Promise<TaskDef> {

      const res = await doc.send(new GetCommand({ TableName: table, Key: { [pk]: taskId } }));

      const task = taskFromItem(res.Item as Record<string, unknown> | undefined, cfg);

      if (!task) throw new HttpError(404, "Task not found");

      return task;

    },



    async getForUser(user: AuthUser, taskId: string): Promise<TaskDef> {

      const task = await this.getOrThrow(taskId);

      assertVisible(user, task);

      return task;

    },



    async listForUser(user: AuthUser, opts: { teamId?: string }): Promise<TaskDef[]> {

      if (user.role === "EMPLOYEE") {

        if (!user.teamId) throw new HttpError(403, "Employee account missing teamId");

        const out: TaskDef[] = [];

        let startKey: Record<string, unknown> | undefined;

        do {

          const res = await doc.send(

            new QueryCommand({

              TableName: table,

              IndexName: gsiTeam,

              KeyConditionExpression: "#t = :tid",

              ExpressionAttributeNames: { "#t": teamAttr },

              ExpressionAttributeValues: { ":tid": user.teamId },

              ExclusiveStartKey: startKey,

            }),

          );

          const items = (res.Items ?? []) as Record<string, unknown>[];

          for (const raw of items) {

            const job = taskFromItem(raw, cfg);

            if (job) out.push(job);

          }

          startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;

        } while (startKey);

        return out;

      }



      if (isManagerLike(user.role)) {

        const filterTeamId = opts.teamId;

        if (filterTeamId) {

          const out: TaskDef[] = [];

          let startKey: Record<string, unknown> | undefined;

          do {

            const res = await doc.send(

              new QueryCommand({

                TableName: table,

                IndexName: gsiTeam,

                KeyConditionExpression: "#t = :tid",

                ExpressionAttributeNames: { "#t": teamAttr },

                ExpressionAttributeValues: { ":tid": filterTeamId },

                ExclusiveStartKey: startKey,

              }),

            );

            const items = (res.Items ?? []) as Record<string, unknown>[];

            for (const raw of items) {

              const job = taskFromItem(raw, cfg);

              if (job) out.push(job);

            }

            startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;

          } while (startKey);

          return out;

        }



        const out: TaskDef[] = [];

        let startKey: Record<string, unknown> | undefined;

        do {

          const res = await doc.send(new ScanCommand({ TableName: table, ExclusiveStartKey: startKey }));

          const items = (res.Items ?? []) as Record<string, unknown>[];

          for (const raw of items) {

            const job = taskFromItem(raw, cfg);

            if (job) out.push(job);

          }

          startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;

        } while (startKey);

        return out;

      }



      return [];

    },



    async listForAssignee(assigneeUserId: string): Promise<TaskDef[]> {

      const out: TaskDef[] = [];

      let startKey: Record<string, unknown> | undefined;

      do {

        const res = await doc.send(

          new QueryCommand({

            TableName: table,

            IndexName: gsiAssignee,

            KeyConditionExpression: "#a = :a",

            ExpressionAttributeNames: { "#a": assigneeAttr },

            ExpressionAttributeValues: { ":a": assigneeUserId },

            ExclusiveStartKey: startKey,

          }),

        );

        const items = (res.Items ?? []) as Record<string, unknown>[];

        for (const raw of items) {

          const job = taskFromItem(raw, cfg);

          if (job) out.push(job);

        }

        startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;

      } while (startKey);

      return out;

    },



    async create(

      user: AuthUser,

      input: Omit<TaskDef, "taskId" | "createdAt" | "updatedAt" | "imageVersions" | "imageCurrentKey"> & { imageCurrentKey?: string },

    ) {

      if (!isManagerLike(user.role)) {

        throw new HttpError(403, "Only managers/admins can create tasks");

      }



      const project = await deps.projects.getOrThrow(input.projectId);

      if (project.teamId !== input.teamId) {

        throw new HttpError(400, "task.teamId must match project.teamId");

      }



      const assignee = await deps.users.get(input.assigneeUserId);

      if (!assignee) throw new HttpError(400, "Assignee not found");

      if (assignee.role === "EMPLOYEE" && assignee.teamId !== input.teamId) {

        throw new HttpError(400, "Assignee must belong to the task team");

      }



      const taskId = crypto.randomUUID();

      const now = new Date().toISOString();



      const versions: TaskImageVersion[] = [];

      if (input.imageCurrentKey) {

        versions.push({ key: input.imageCurrentKey, uploadedAt: now, uploadedByUserId: user.userId });

      }



      const task: TaskDef = {

        taskId,

        projectId: input.projectId,

        teamId: input.teamId,

        title: input.title,

        description: input.description,

        status: input.status,

        priority: input.priority,

        deadline: input.deadline,

        assigneeUserId: input.assigneeUserId,

        createdByUserId: input.createdByUserId,

        imageCurrentKey: input.imageCurrentKey,

        imageVersions: versions,

        createdAt: now,

        updatedAt: now,

      };



      await doc.send(

        new PutCommand({

          TableName: table,

          Item: taskToItem(task, cfg),

          ConditionExpression: "attribute_not_exists(#pk)",

          ExpressionAttributeNames: { "#pk": pk },

        }),

      );



      await deps.cw.incrementTasksCreated(task.teamId);

      await publishAssignedIfNeeded(task, user.userId);



      return task;

    },



    async update(

      user: AuthUser,

      taskId: string,

      patch: Partial<

        Pick<

          TaskDef,

          | "title"

          | "description"

          | "priority"

          | "deadline"

          | "assigneeUserId"

          | "teamId"

          | "projectId"

          | "status"

          | "imageCurrentKey"

        >

      >,

    ) {

      const existing = await this.getForUser(user, taskId);

      const fromStatus = existing.status;



      if (user.role === "EMPLOYEE") {

        const keys = Object.keys(patch);

        const allowedKeys = new Set(["status", "imageCurrentKey"]);

        const illegal = keys.filter((k) => !allowedKeys.has(k));

        if (illegal.length) {

          throw new HttpError(403, "Employees can only update status/image on assigned tasks");

        }

        if (existing.assigneeUserId !== user.userId) {

          throw new HttpError(403, "Only the assignee can update this task");

        }

        if (patch.status !== undefined) {

          assertValidStatus(patch.status);

          if (!forwardAllowed(existing.status, patch.status)) {

            throw new HttpError(400, "Invalid status transition for employee");

          }

        }

      }



      if (isManagerLike(user.role)) {

        if (patch.status !== undefined) {

          assertValidStatus(patch.status);

        }

      }



      let nextTeamId = existing.teamId;

      let nextProjectId = existing.projectId;



      if (patch.teamId !== undefined || patch.projectId !== undefined) {

        if (!isManagerLike(user.role)) {

          throw new HttpError(403, "Only managers/admins can move tasks between teams/projects");

        }

      }



      if (patch.projectId !== undefined) {

        const p = await deps.projects.getOrThrow(patch.projectId);

        nextProjectId = p.projectId;

        nextTeamId = patch.teamId ?? p.teamId;

        if (patch.teamId !== undefined && patch.teamId !== p.teamId) {

          throw new HttpError(400, "task.teamId must match selected project.teamId");

        }

        if (patch.teamId === undefined) {

          nextTeamId = p.teamId;

        }

      } else if (patch.teamId !== undefined) {

        nextTeamId = patch.teamId;

        const p = await deps.projects.getOrThrow(existing.projectId);

        if (p.teamId !== nextTeamId) {

          throw new HttpError(400, "Change projectId when moving tasks to another team");

        }

      }



      if (patch.assigneeUserId !== undefined) {

        if (!isManagerLike(user.role)) {

          throw new HttpError(403, "Only managers/admins can reassign tasks");

        }

        const assignee = await deps.users.get(patch.assigneeUserId);

        if (!assignee) throw new HttpError(400, "Assignee not found");

        if (assignee.role === "EMPLOYEE" && assignee.teamId !== nextTeamId) {

          throw new HttpError(400, "Assignee must belong to the task team");

        }

      }



      const now = new Date().toISOString();

      const next: TaskDef = {

        ...existing,

        title: patch.title ?? existing.title,

        description: patch.description ?? existing.description,

        priority: (patch.priority ?? existing.priority) as TaskPriority,

        deadline: patch.deadline ?? existing.deadline,

        assigneeUserId: patch.assigneeUserId ?? existing.assigneeUserId,

        teamId: nextTeamId,

        projectId: nextProjectId,

        status: (patch.status ?? existing.status) as TaskStatus,

        updatedAt: now,

      };



      let imageVersions = existing.imageVersions ?? [];

      if (patch.imageCurrentKey !== undefined) {

        const nextKey = patch.imageCurrentKey;

        if (existing.imageCurrentKey && existing.imageCurrentKey !== nextKey) {

          imageVersions = [

            ...imageVersions,

            { key: existing.imageCurrentKey, uploadedAt: now, uploadedByUserId: user.userId },

          ];

        }

        if (nextKey) {

          imageVersions = [...imageVersions, { key: nextKey, uploadedAt: now, uploadedByUserId: user.userId }];

        }

        next.imageCurrentKey = nextKey || undefined;

        next.imageVersions = imageVersions;

      }



      await doc.send(

        new PutCommand({

          TableName: table,

          Item: taskToItem(next, cfg),

          ConditionExpression: "attribute_exists(#pk)",

          ExpressionAttributeNames: { "#pk": pk },

        }),

      );



      if (patch.status !== undefined && patch.status !== fromStatus) {

        await deps.audits.record({

          taskId,

          actorUserId: user.userId,

          fromStatus,

          toStatus: patch.status,

        });

      }



      if (patch.status === "DONE" && fromStatus !== "DONE") {

        await deps.cw.incrementTasksClosed(next.teamId);

        const created = Date.parse(next.createdAt);

        const closed = Date.now();

        if (!Number.isNaN(created)) {

          await deps.cw.recordTimeToCloseMs(next.teamId, Math.max(0, closed - created));

        }

      }



      if (isManagerLike(user.role) && patch.assigneeUserId !== undefined && patch.assigneeUserId !== existing.assigneeUserId) {

        await publishAssignedIfNeeded(next, user.userId);

      }



      return next;

    },



    async delete(user: AuthUser, taskId: string) {

      if (!isManagerLike(user.role)) {

        throw new HttpError(403, "Only managers/admins can delete tasks");

      }

      const task = await this.getForUser(user, taskId);



      const keys = new Set<string>();

      if (task.imageCurrentKey) keys.add(task.imageCurrentKey);

      for (const v of task.imageVersions ?? []) keys.add(v.key);



      await deps.comments.deleteAllForTask(taskId);



      const audits = await deps.audits.listForTask(taskId);

      for (const a of audits) {

        await doc.send(

          new DeleteCommand({

            TableName: cfg.DYNAMO_TABLE_TASK_AUDIT,

            Key: { [auditPk]: a.taskId, [auditSk]: a.auditId },

          }),

        );

      }



      await doc.send(

        new DeleteCommand({

          TableName: table,

          Key: { [pk]: taskId },

          ConditionExpression: "attribute_exists(#pk)",

          ExpressionAttributeNames: { "#pk": pk },

        }),

      );



      for (const key of keys) {

        try {

          await deps.s3.deleteObject(key);

        } catch {

          // Best-effort cleanup

        }

      }

    },



    async commitImageUpload(user: AuthUser, taskId: string, key: string) {

      return await this.update(user, taskId, { imageCurrentKey: key });

    },

  };

}

