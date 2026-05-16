import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { createArifOSAgentCard, createMCPManifest } from "../discovery/index.js";
import { createPersonalOS, type HumanCommand, type HumanIntent, type HumanResponse } from "../personal-v2/index.js";
import type {
  A2AArtifact,
  A2ACancelTaskParams,
  A2AGetTaskParams,
  A2AListTasksParams,
  A2AMessage,
  A2APart,
  A2ASendMessageParams,
  A2ATask,
  A2ATaskState,
  JsonRpcError,
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcSuccess,
} from "./types.js";

const SUPPORTED_A2A_VERSIONS = new Set(["0.3", "1.0"]);
const TASK_NOT_FOUND_ERROR = -32001;
const TASK_NOT_CANCELABLE_ERROR = -32002;
const UNSUPPORTED_OPERATION_ERROR = -32003;
const VERSION_NOT_SUPPORTED_ERROR = -32004;

const taskStore = new Map<string, A2ATask>();

function getBaseUrl(req: Request): string {
  const forwardedProto = req.get("x-forwarded-proto");
  const forwardedHost = req.get("x-forwarded-host");
  const protocol = forwardedProto?.split(",")[0]?.trim() || req.protocol;
  const host = forwardedHost?.split(",")[0]?.trim() || req.get("host") || "127.0.0.1";
  return `${protocol}://${host}`;
}

function jsonRpcSuccess<T>(id: JsonRpcId, result: T): JsonRpcSuccess<T> {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: Record<string, unknown>,
): JsonRpcError {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

function getRequestedVersion(req: Request): string {
  const headerVersion = req.get("A2A-Version");
  const queryVersion = typeof req.query["A2A-Version"] === "string" ? req.query["A2A-Version"] : undefined;
  return headerVersion || queryVersion || "0.3";
}

function validateVersion(req: Request): JsonRpcError | null {
  const version = getRequestedVersion(req);
  if (SUPPORTED_A2A_VERSIONS.has(version)) {
    return null;
  }

  return jsonRpcError(null, VERSION_NOT_SUPPORTED_ERROR, "A2A version not supported", {
    code: "VersionNotSupportedError",
    requestedVersion: version,
    supportedVersions: Array.from(SUPPORTED_A2A_VERSIONS),
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHumanCommand(value: unknown): value is HumanCommand {
  return value === "remember" ||
    value === "recall" ||
    value === "track" ||
    value === "think" ||
    value === "hold" ||
    value === "execute";
}

function inferIntentFromText(text: string): HumanIntent {
  const trimmed = text.trim();
  const prefixed = trimmed.match(/^(remember|recall|track|think|hold|execute)\s*:\s*(.+)$/i);
  if (prefixed) {
    return {
      command: prefixed[1].toLowerCase() as HumanCommand,
      what: prefixed[2].trim(),
    };
  }

  return {
    command: "think",
    what: trimmed,
  };
}

function parseIntent(message: A2AMessage): HumanIntent {
  for (const part of message.parts) {
    if (isObject(part.data)) {
      const command = part.data.command;
      const what = part.data.what;
      const why = part.data.why;
      const urgency = part.data.urgency;

      if (!isHumanCommand(command) || typeof what !== "string" || what.trim() === "") {
        throw new Error("Structured A2A data parts must include a valid command and non-empty what field");
      }

      const intent: HumanIntent = {
        command,
        what,
      };
      if (typeof why === "string") {
        intent.why = why;
      }
      if (urgency === "now" || urgency === "soon" || urgency === "later") {
        intent.urgency = urgency;
      }
      return intent;
    }

    if (typeof part.text === "string" && part.text.trim() !== "") {
      return inferIntentFromText(part.text);
    }
  }

  throw new Error("A2A message must include at least one text or data part");
}

function mapResponseToTaskState(response: HumanResponse): A2ATaskState {
  switch (response.state) {
    case "rejected":
    case "expired":
      return "TASK_STATE_REJECTED";
    case "holding":
    case "ready":
    case "approved":
    case "thinking":
    case "drafting":
    case "executing":
    case "executed":
    default:
      return "TASK_STATE_COMPLETED";
  }
}

function createAgentMessage(contextId: string, taskId: string, response: HumanResponse): A2AMessage {
  return {
    messageId: randomUUID(),
    contextId,
    taskId,
    role: "ROLE_AGENT",
    parts: [
      {
        text: response.summary,
        mediaType: "text/plain",
      },
      {
        data: response,
        mediaType: "application/json",
      },
    ],
    metadata: {
      arifos: {
        badge: response.badge,
        state: response.state,
        holdId: response.holdId,
        memoryId: response.memoryId,
        next: response.next,
      },
    },
  };
}

function createArtifact(intent: HumanIntent, response: HumanResponse): A2AArtifact {
  return {
    artifactId: randomUUID(),
    name: `${intent.command}-result`,
    description: response.summary,
    parts: [
      {
        text: response.summary,
        mediaType: "text/plain",
      },
      {
        data: response,
        mediaType: "application/json",
      },
    ],
    metadata: {
      arifos: {
        command: intent.command,
        holdId: response.holdId,
        memoryId: response.memoryId,
      },
    },
  };
}

function applyHistoryWindow(task: A2ATask, historyLength?: number): A2ATask {
  if (historyLength === undefined) {
    return task;
  }

  if (historyLength <= 0) {
    const { history: _history, ...withoutHistory } = task;
    return withoutHistory;
  }

  return {
    ...task,
    history: task.history?.slice(-historyLength),
  };
}

function applyArtifactFilter(task: A2ATask, includeArtifacts: boolean): A2ATask {
  if (includeArtifacts) {
    return task;
  }

  const { artifacts: _artifacts, ...withoutArtifacts } = task;
  return withoutArtifacts;
}

async function handleSendMessage(params: A2ASendMessageParams): Promise<A2ATask> {
  if (!params || !params.message || !Array.isArray(params.message.parts) || params.message.parts.length === 0) {
    throw new Error("SendMessage requires a message with at least one part");
  }

  if (params.message.role !== "ROLE_USER") {
    throw new Error("SendMessage only accepts ROLE_USER messages");
  }

  if (!params.message.messageId || typeof params.message.messageId !== "string") {
    throw new Error("SendMessage requires message.messageId");
  }

  if (params.message.taskId) {
    const existingTask = taskStore.get(params.message.taskId);
    if (!existingTask) {
      throw Object.assign(new Error("Task not found"), { a2aCode: "TaskNotFoundError" });
    }

    if (existingTask.status.state === "TASK_STATE_COMPLETED" ||
        existingTask.status.state === "TASK_STATE_FAILED" ||
        existingTask.status.state === "TASK_STATE_CANCELED" ||
        existingTask.status.state === "TASK_STATE_REJECTED") {
      throw Object.assign(new Error("Task is already in a terminal state"), { a2aCode: "UnsupportedOperationError" });
    }
  }

  const intent = parseIntent(params.message);
  const os = await createPersonalOS();
  const response = await os.process(intent);
  const contextId = params.message.contextId ?? randomUUID();
  const taskId = params.message.taskId ?? randomUUID();
  const agentMessage = createAgentMessage(contextId, taskId, response);
  const task: A2ATask = {
    id: taskId,
    contextId,
    status: {
      state: mapResponseToTaskState(response),
      message: agentMessage,
      timestamp: new Date().toISOString(),
    },
    artifacts: [createArtifact(intent, response)],
    history: [params.message, agentMessage],
    metadata: {
      arifos: {
        command: intent.command,
        holdId: response.holdId,
        memoryId: response.memoryId,
        taskIntent: response.summary,
      },
    },
  };

  taskStore.set(task.id, task);
  return applyHistoryWindow(task, params.configuration?.historyLength);
}

function handleGetTask(params: A2AGetTaskParams): A2ATask {
  const task = taskStore.get(params.id);
  if (!task) {
    throw Object.assign(new Error("Task not found"), { a2aCode: "TaskNotFoundError" });
  }

  return applyHistoryWindow(task, params.historyLength);
}

function handleListTasks(params: A2AListTasksParams): {
  tasks: A2ATask[];
  nextPageToken: string;
  pageSize: number;
  totalSize: number;
} {
  const filtered = Array.from(taskStore.values())
    .filter((task) => !params.contextId || task.contextId === params.contextId)
    .filter((task) => !params.status || task.status.state === params.status)
    .sort((left, right) => {
      const leftTime = left.status.timestamp ? Date.parse(left.status.timestamp) : 0;
      const rightTime = right.status.timestamp ? Date.parse(right.status.timestamp) : 0;
      return rightTime - leftTime;
    });

  const pageSize = Math.max(1, Math.min(params.pageSize ?? 50, 100));
  const offset = params.pageToken ? parseInt(params.pageToken, 10) || 0 : 0;
  const paged = filtered.slice(offset, offset + pageSize).map((task) => {
    const withHistory = applyHistoryWindow(task, params.historyLength);
    return applyArtifactFilter(withHistory, params.includeArtifacts ?? false);
  });
  const nextOffset = offset + pageSize;

  return {
    tasks: paged,
    nextPageToken: nextOffset < filtered.length ? String(nextOffset) : "",
    pageSize,
    totalSize: filtered.length,
  };
}

function handleCancelTask(params: A2ACancelTaskParams): A2ATask {
  const task = taskStore.get(params.id);
  if (!task) {
    throw Object.assign(new Error("Task not found"), { a2aCode: "TaskNotFoundError" });
  }

  if (task.status.state === "TASK_STATE_COMPLETED" ||
      task.status.state === "TASK_STATE_FAILED" ||
      task.status.state === "TASK_STATE_CANCELED" ||
      task.status.state === "TASK_STATE_REJECTED") {
    throw Object.assign(new Error("Task is not cancelable"), { a2aCode: "TaskNotCancelableError" });
  }

  const canceled: A2ATask = {
    ...task,
    status: {
      state: "TASK_STATE_CANCELED",
      timestamp: new Date().toISOString(),
      message: {
        messageId: randomUUID(),
        contextId: task.contextId,
        taskId: task.id,
        role: "ROLE_AGENT",
        parts: [
          {
            text: "Task canceled",
            mediaType: "text/plain",
          },
        ],
      },
    },
  };

  taskStore.set(task.id, canceled);
  return canceled;
}

function mapA2AError(id: JsonRpcId, error: unknown): JsonRpcError {
  if (error instanceof Error) {
    if ((error as Error & { a2aCode?: string }).a2aCode === "TaskNotFoundError") {
      return jsonRpcError(id, TASK_NOT_FOUND_ERROR, error.message, { code: "TaskNotFoundError" });
    }
    if ((error as Error & { a2aCode?: string }).a2aCode === "TaskNotCancelableError") {
      return jsonRpcError(id, TASK_NOT_CANCELABLE_ERROR, error.message, { code: "TaskNotCancelableError" });
    }
    if ((error as Error & { a2aCode?: string }).a2aCode === "UnsupportedOperationError") {
      return jsonRpcError(id, UNSUPPORTED_OPERATION_ERROR, error.message, { code: "UnsupportedOperationError" });
    }
    return jsonRpcError(id, -32602, error.message);
  }

  return jsonRpcError(id, -32603, "Internal error");
}

export function createA2ARouter(): express.Router {
  const router = express.Router();

  router.get("/.well-known/agent-card.json", (req: Request, res: Response) => {
    res.json(createArifOSAgentCard(getBaseUrl(req)));
  });

  router.get("/.well-known/mcp", (_req: Request, res: Response) => {
    res.json(createMCPManifest());
  });

  router.post("/a2a", async (req: Request, res: Response) => {
    const versionError = validateVersion(req);
    if (versionError) {
      res.status(400).json(versionError);
      return;
    }

    const body = req.body as JsonRpcRequest;
    if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
      res.status(400).json(jsonRpcError(null, -32600, "Invalid Request"));
      return;
    }

    try {
      switch (body.method) {
        case "SendMessage":
          res.json(jsonRpcSuccess(body.id ?? null, await handleSendMessage((body.params ?? {}) as unknown as A2ASendMessageParams)));
          return;
        case "GetTask":
          res.json(jsonRpcSuccess(body.id ?? null, handleGetTask((body.params ?? {}) as unknown as A2AGetTaskParams)));
          return;
        case "ListTasks":
          res.json(jsonRpcSuccess(body.id ?? null, handleListTasks((body.params ?? {}) as A2AListTasksParams)));
          return;
        case "CancelTask":
          res.json(jsonRpcSuccess(body.id ?? null, handleCancelTask((body.params ?? {}) as unknown as A2ACancelTaskParams)));
          return;
        case "SendStreamingMessage":
        case "SubscribeToTask":
          res.status(400).json(
            jsonRpcError(body.id ?? null, UNSUPPORTED_OPERATION_ERROR, `${body.method} is not supported`, {
              code: "UnsupportedOperationError",
            }),
          );
          return;
        default:
          res.status(404).json(jsonRpcError(body.id ?? null, -32601, "Method not found"));
      }
    } catch (error) {
      const rpcError = mapA2AError(body.id ?? null, error);
      const status = rpcError.error.code === -32603 ? 500 : 400;
      res.status(status).json(rpcError);
    }
  });

  router.get("/a2a/tasks/:id", (req: Request, res: Response) => {
    try {
      const task = handleGetTask({
        id: req.params.id,
        historyLength: typeof req.query.historyLength === "string" ? parseInt(req.query.historyLength, 10) : undefined,
      });
      res.json(task);
    } catch (error) {
      const rpcError = mapA2AError(null, error);
      res.status(404).json({
        ok: false,
        error: rpcError.error,
      });
    }
  });

  router.post("/a2a/tasks/:id/cancel", (req: Request, res: Response) => {
    try {
      const task = handleCancelTask({
        id: req.params.id,
        metadata: isObject(req.body) ? req.body : undefined,
      });
      res.json(task);
    } catch (error) {
      const rpcError = mapA2AError(null, error);
      res.status(400).json({
        ok: false,
        error: rpcError.error,
      });
    }
  });

  return router;
}
