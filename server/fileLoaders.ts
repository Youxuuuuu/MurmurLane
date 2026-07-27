import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  type JsonFileResult,
  type TextFileResult,
} from "./types.js";

function isPathWithinRoot(targetPath: string, rootPath: string) {
  const relative = path.relative(rootPath, targetPath);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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

export interface ServerAccess {
  readonly dataRoot: string;
  resolveDataPath(...parts: string[]): string;
  resolveReadableCyberbossFilePath(filePath: string): string | null;
  findExistingDataPath(paths: string[]): Promise<string>;
  readDataTextFile(...relativeParts: string[]): Promise<TextFileResult>;
  readDataJsonFile<T>(
    ...relativeParts: string[]
  ): Promise<JsonFileResult<T>>;
  listDataFileNames(...relativeParts: string[]): Promise<string[]>;
}

export function createServerAccess(dataRoot: string): ServerAccess {
  const normalizedRoot = path.resolve(dataRoot);
  const resolveDataPath = (...parts: string[]) =>
    path.resolve(normalizedRoot, ...parts);

  return Object.freeze({
    dataRoot: normalizedRoot,
    resolveDataPath,
    resolveReadableCyberbossFilePath(filePath: string) {
      const rawPath = String(filePath ?? "").trim();
      if (!rawPath) return null;
      const resolvedPath = path.isAbsolute(rawPath)
        ? path.resolve(rawPath)
        : resolveDataPath(rawPath);
      return isPathWithinRoot(resolvedPath, normalizedRoot)
        ? resolvedPath
        : null;
    },
    async findExistingDataPath(paths: string[]) {
      for (const relativePath of paths) {
        const absolutePath = resolveDataPath(relativePath);
        if (await fileExists(absolutePath)) return absolutePath;
      }
      return resolveDataPath(paths[0] || "");
    },
    readDataTextFile(...relativeParts: string[]) {
      return readTextFile(resolveDataPath(...relativeParts));
    },
    readDataJsonFile<T>(...relativeParts: string[]) {
      return readJsonFile<T>(resolveDataPath(...relativeParts));
    },
    async listDataFileNames(...relativeParts: string[]) {
      const directoryPath = resolveDataPath(...relativeParts);
      try {
        const entries = await readdir(directoryPath, {
          withFileTypes: true,
        });
        return entries
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return [];
        }
        throw error;
      }
    },
  });
}
