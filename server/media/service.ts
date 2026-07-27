import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ServerAccess } from "../fileLoaders.js";

const allowedMediaExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".avif",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
]);
const stickerAssetExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
]);

function getMomentDateParts(offset: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - offset);
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    day: String(date.getDate()).padStart(2, "0"),
  };
}

export function createMediaService(input: {
  readonly access: ServerAccess;
  readonly maxFileBytes: number;
  readonly publicDirectory: string;
}) {
  const stickerRoot = input.access.resolveDataPath("stickers");

  return Object.freeze({
    async listStickers() {
      const assetRoot = path.join(stickerRoot, "assets");
      const files = (
        await readdir(assetRoot, { withFileTypes: true })
      )
        .filter(
          (entry) =>
            entry.isFile() &&
            stickerAssetExtensions.has(
              path.extname(entry.name).toLowerCase(),
            ),
        )
        .map((entry) => entry.name)
        .sort((left, right) =>
          left.localeCompare(right, "zh-CN", {
            numeric: true,
          }),
        );
      let index: Record<
        string,
        {
          name?: string;
          tags?: string[];
          category?: string;
          desc?: string;
        }
      > = {};
      try {
        index = JSON.parse(
          await readFile(
            path.join(stickerRoot, "index.json"),
            "utf8",
          ),
        );
      } catch {
        // 可选元数据缺失时仍允许直接使用贴纸资源目录。
      }
      return files.map((fileName) => {
        const id = path.parse(fileName).name;
        const metadata = index[id] || {};
        const fallbackName = `${id}.png`;
        const fallbackPath = path.join(
          input.publicDirectory,
          "stickers",
          fallbackName,
        );
        return {
          id,
          fileName,
          name: metadata.name || id,
          tags: Array.isArray(metadata.tags)
            ? metadata.tags
            : [],
          category: metadata.category || "",
          description: metadata.desc || "",
          src: existsSync(fallbackPath)
            ? `/stickers/${encodeURIComponent(fallbackName)}`
            : `/api/stickers/assets/${encodeURIComponent(
                fileName,
              )}?raw=1`,
        };
      });
    },
    async readStickerAsset(fileName: string) {
      const safeName = path.basename(String(fileName || ""));
      const extension = path.extname(safeName).toLowerCase();
      if (
        !safeName ||
        safeName !== fileName ||
        !stickerAssetExtensions.has(extension)
      ) {
        return null;
      }
      const filePath = path.join(
        stickerRoot,
        "assets",
        safeName,
      );
      if (!existsSync(filePath)) return null;
      return {
        path: filePath,
        extension,
        bytes: await readFile(filePath),
      };
    },
    async resolveFile(requestedPath: string) {
      const filePath =
        input.access.resolveReadableCyberbossFilePath(
          requestedPath,
        );
      if (!filePath) {
        return { status: 403 as const, reason: "forbidden_path" };
      }
      const extension = path.extname(filePath).toLowerCase();
      if (!allowedMediaExtensions.has(extension)) {
        return {
          status: 415 as const,
          reason: "unsupported_extension",
          extension,
        };
      }
      let fileStat;
      try {
        fileStat = await stat(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
        return {
          status: 404 as const,
          reason: "not_found",
          extension,
        };
      }
      if (!fileStat.isFile()) {
        return {
          status: 404 as const,
          reason: "not_file",
          extension,
          size: fileStat.size,
        };
      }
      if (fileStat.size > input.maxFileBytes) {
        return {
          status: 413 as const,
          reason: "file_too_large",
          extension,
          size: fileStat.size,
        };
      }
      return {
        status: 200 as const,
        reason: "ok",
        path: filePath,
        extension,
        size: fileStat.size,
      };
    },
    async listMoments(days: number) {
      const momentRoot = input.access.resolveDataPath(
        "MLane",
        "moment",
      );
      const moments: Array<{
        id: string;
        date: string;
        fileName: string;
        path: string;
        src: string;
      }> = [];
      for (let offset = 0; offset < days; offset += 1) {
        const { year, month, day } =
          getMomentDateParts(offset);
        const date = `${year}-${month}-${day}`;
        const directoryPath = path.join(
          momentRoot,
          year,
          month,
          day,
        );
        let entries;
        try {
          entries = await readdir(directoryPath, {
            withFileTypes: true,
          });
        } catch (error) {
          if (
            (error as NodeJS.ErrnoException).code === "ENOENT"
          ) {
            continue;
          }
          throw error;
        }
        entries
          .filter(
            (entry) =>
              entry.isFile() &&
              allowedMediaExtensions.has(
                path.extname(entry.name).toLowerCase(),
              ),
          )
          .sort((left, right) =>
            left.name.localeCompare(right.name),
          )
          .forEach((entry) => {
            const filePath = path.join(
              directoryPath,
              entry.name,
            );
            moments.push({
              id: `${date}:${entry.name}`,
              date,
              fileName: entry.name,
              path: filePath,
              src: `/api/file?path=${encodeURIComponent(
                filePath,
              )}`,
            });
          });
      }
      return { root: momentRoot, days, moments };
    },
  });
}
