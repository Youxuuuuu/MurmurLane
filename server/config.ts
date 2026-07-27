import path from "node:path";
import { DEFAULT_CYBERBOSS_DATA_ROOT } from "./types.js";

const DEFAULT_API_FILE_MAX_BYTES = 25 * 1024 * 1024;

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly dataRoot: string;
  readonly editToken: string;
  readonly apiFileMaxBytes: number;
  readonly staticDistDirectory: string;
  readonly publicDirectory: string;
}

function trimmed(value: string | undefined) {
  return String(value ?? "").trim();
}

function parsePort(value: string | undefined) {
  const raw = trimmed(value);
  if (!raw) return 8787;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("Server 端口配置无效。");
  }
  return port;
}

function parseFileLimit(value: string | undefined) {
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0
    ? limit
    : DEFAULT_API_FILE_MAX_BYTES;
}

export function parseServerConfig(
  environment: Readonly<Record<string, string | undefined>>,
  cwd = process.cwd(),
): ServerConfig {
  return Object.freeze({
    host: trimmed(environment.API_HOST) || "127.0.0.1",
    port: parsePort(environment.PORT || environment.API_PORT),
    dataRoot: path.resolve(
      trimmed(environment.CYBERBOSS_DATA_ROOT) ||
        DEFAULT_CYBERBOSS_DATA_ROOT,
    ),
    editToken: trimmed(environment.MURMURLANE_EDIT_TOKEN),
    apiFileMaxBytes: parseFileLimit(
      environment.API_FILE_MAX_BYTES,
    ),
    staticDistDirectory: path.resolve(cwd, "dist"),
    publicDirectory: path.resolve(cwd, "public"),
  });
}
