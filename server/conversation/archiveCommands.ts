import { execFile } from "node:child_process";
import path from "node:path";
import type { ServerConfig } from "../config.js";
import {
  ConflictError,
  InvalidInputError,
  ServerDomainError,
} from "../domainErrors.js";

export interface ConversationDeleteResult {
  readonly threadId: string;
  readonly deletedRecordCount: number;
  readonly touchedDates: readonly string[];
  readonly deletedSourceKeys: readonly string[];
}

export type ConversationArchiveCliRunner = (
  executable: string,
  args: readonly string[],
) => Promise<{
  readonly stdout: string;
  readonly stderr: string;
}>;

export interface ConversationArchiveCommandDependencies {
  readonly config: ServerConfig;
  readonly fetchImpl?: typeof fetch;
  readonly runCli?: ConversationArchiveCliRunner;
}

export function createConversationArchiveCommands({
  config,
  fetchImpl = fetch,
  runCli = runCliProcess,
}: ConversationArchiveCommandDependencies) {
  const deleteThreadOnline = async (
    threadId: string,
  ): Promise<ConversationDeleteResult | null> => {
    let response: Response;
    try {
      response = await fetchImpl(
        `${config.cyberbossWebChatUrl}/api/chat/thread/${encodeURIComponent(threadId)}`,
        {
          method: "DELETE",
          headers: config.cyberbossWebChatToken
            ? {
                Authorization: `Bearer ${config.cyberbossWebChatToken}`,
              }
            : undefined,
          signal: AbortSignal.timeout(400),
        },
      );
    } catch {
      return null;
    }

    if (response.status === 404 || response.status === 405) {
      return null;
    }
    const payload = await readJsonPayload(response);
    if (!response.ok) {
      throwOnlineDeleteError(response.status, getErrorMessage(payload));
    }
    return normalizeDeleteResult(payload, threadId);
  };

  const deleteThreadOffline = async (
    threadId: string,
  ): Promise<ConversationDeleteResult> => {
    let output: Awaited<ReturnType<ConversationArchiveCliRunner>>;
    try {
      output = await runCli(process.execPath, [
        config.cyberbossCliPath,
        "conversation:delete",
        "--thread-id",
        threadId,
        "--conversation-dir",
        path.join(config.dataRoot, "conversations"),
        "--json",
      ]);
    } catch (error) {
      const message = getProcessErrorMessage(error);
      if (/locked|active work/i.test(message)) {
        throw new ConflictError(message);
      }
      throw error;
    }
    return normalizeDeleteResult(
      parseCliJson(output.stdout),
      threadId,
    );
  };

  return Object.freeze({
    async deleteThread(
      requestedThreadId: string,
    ): Promise<ConversationDeleteResult> {
      const threadId = normalizeThreadId(requestedThreadId);
      const online = await deleteThreadOnline(threadId);
      return online ?? deleteThreadOffline(threadId);
    },
  });
}

function normalizeThreadId(value: string) {
  const threadId = String(value || "").trim().replace(/\s+/g, "");
  if (!threadId) {
    throw new InvalidInputError("Thread id is required.");
  }
  return threadId;
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Cyberboss returned an invalid deletion response.");
  }
}

function normalizeDeleteResult(
  payload: unknown,
  requestedThreadId: string,
): ConversationDeleteResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cyberboss returned an invalid deletion response.");
  }
  const value = payload as Record<string, unknown>;
  const threadId =
    typeof value.threadId === "string" ? value.threadId.trim() : "";
  const deletedRecordCount = Number(value.deletedRecordCount);
  const touchedDates = normalizeStringArray(value.touchedDates);
  const deletedSourceKeys = normalizeStringArray(
    value.deletedSourceKeys,
  );
  if (
    threadId !== requestedThreadId ||
    !Number.isSafeInteger(deletedRecordCount) ||
    deletedRecordCount < 0 ||
    !touchedDates ||
    !deletedSourceKeys
  ) {
    throw new Error("Cyberboss returned an invalid deletion response.");
  }
  return {
    threadId,
    deletedRecordCount,
    touchedDates,
    deletedSourceKeys,
  };
}

function normalizeStringArray(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string")
  ) {
    return null;
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function getErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "Cyberboss could not delete the conversation thread.";
  }
  const message = (payload as Record<string, unknown>).error;
  return typeof message === "string" && message.trim()
    ? message.trim()
    : "Cyberboss could not delete the conversation thread.";
}

function throwOnlineDeleteError(status: number, message: string): never {
  if (status === 409) throw new ConflictError(message);
  if (status === 400) throw new InvalidInputError(message);
  if (status === 401 || status === 403) {
    throw new ServerDomainError("access-denied", message);
  }
  throw new Error(message);
}

function parseCliJson(stdout: string) {
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();
  for (const line of lines) {
    try {
      return JSON.parse(line) as unknown;
    } catch {
      // Continue past any diagnostic lines emitted before the JSON result.
    }
  }
  throw new Error("Cyberboss CLI returned an invalid deletion response.");
}

function getProcessErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : String(error);
  }
  const value = error as {
    message?: unknown;
    stderr?: unknown;
  };
  return String(value.stderr || value.message || error).trim();
}

function runCliProcess(
  executable: string,
  args: readonly string[],
): ReturnType<ConversationArchiveCliRunner> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      [...args],
      {
        cwd: path.dirname(args[0] || process.cwd()),
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          Object.assign(error, { stdout, stderr });
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}
