import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_CYBERBOSS_DATA_ROOT,
  type JsonFileResult,
  type TextFileResult,
} from "./types.js";

export function getCyberbossDataRoot() {
  return path.resolve(
    process.env.CYBERBOSS_DATA_ROOT || DEFAULT_CYBERBOSS_DATA_ROOT,
  );
}

export function resolveDataPath(...parts: string[]) {
  return path.resolve(getCyberbossDataRoot(), ...parts);
}

export async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findExistingDataPath(paths: string[]) {
  for (const relativePath of paths) {
    const absolutePath = resolveDataPath(relativePath);
    if (await fileExists(absolutePath)) {
      return absolutePath;
    }
  }

  return resolveDataPath(paths[0] || "");
}

export async function readTextFile(filePath: string): Promise<TextFileResult> {
  try {
    const content = await readFile(filePath, "utf8");
    return {
      found: true,
      path: filePath,
      content,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        found: false,
        path: filePath,
        content: null,
      };
    }

    throw error;
  }
}

export async function readDataTextFile(
  ...relativeParts: string[]
): Promise<TextFileResult> {
  return readTextFile(resolveDataPath(...relativeParts));
}

export async function readJsonFile<T>(filePath: string): Promise<JsonFileResult<T>> {
  const result = await readTextFile(filePath);

  if (!result.found || result.content == null) {
    return {
      found: false,
      path: result.path,
      data: null,
    };
  }

  return {
    found: true,
    path: result.path,
    data: JSON.parse(result.content) as T,
  };
}

export async function readDataJsonFile<T>(
  ...relativeParts: string[]
): Promise<JsonFileResult<T>> {
  return readJsonFile<T>(resolveDataPath(...relativeParts));
}

export async function readJsonLinesFile<T>(filePath: string) {
  const result = await readTextFile(filePath);

  if (!result.found || result.content == null) {
    return {
      found: false,
      path: result.path,
      records: [] as T[],
    };
  }

  const records = result.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);

  return {
    found: true,
    path: result.path,
    records,
  };
}

export async function listDataFileNames(...relativeParts: string[]) {
  const directoryPath = resolveDataPath(...relativeParts);

  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}
