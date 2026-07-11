import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveDataPath } from "./fileLoaders.js";

export interface StoredConversationProfile {
  name: string;
  handle: string;
  signature: string;
  background?: string;
  avatarFile?: string;
  backgroundImageFile?: string;
  threadId?: string;
  updatedAt?: string;
}

export interface ConversationProfilePayload {
  name?: unknown;
  handle?: unknown;
  signature?: unknown;
  background?: unknown;
  avatar?: unknown;
  backgroundImage?: unknown;
}

const profileRoot = () => resolveDataPath("MLane", "profiles");
const maxImageBytes = 2 * 1024 * 1024;
const imageDataPattern = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([a-z0-9+/=]+)$/i;

function assertThreadId(threadId: string) {
  if (!/^[a-zA-Z0-9._-]{1,128}$/.test(threadId)) {
    throw new Error("Invalid conversation thread id.");
  }
}

function getProfileDirectory(scope: "user" | "thread", threadId?: string) {
  if (scope === "user") return path.join(profileRoot(), "self");
  assertThreadId(String(threadId || ""));
  return path.join(profileRoot(), "threads", String(threadId));
}

function imageExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/avif") return ".avif";
  return ".png";
}

async function readStoredProfile(directoryPath: string) {
  try {
    return JSON.parse(
      await readFile(path.join(directoryPath, "profile.json"), "utf8"),
    ) as StoredConversationProfile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function profileFileUrl(
  directoryPath: string,
  fileName?: string,
  updatedAt?: string,
) {
  if (!fileName) return "";
  const filePath = path.join(directoryPath, fileName);
  return `/api/file?path=${encodeURIComponent(filePath)}&v=${encodeURIComponent(updatedAt || "")}`;
}

function toClientProfile(profile: StoredConversationProfile, directoryPath: string) {
  return {
    name: profile.name,
    handle: profile.handle,
    signature: profile.signature,
    background: profile.background || "#fbfbfa",
    avatar: profileFileUrl(directoryPath, profile.avatarFile, profile.updatedAt),
    backgroundImage: profileFileUrl(
      directoryPath,
      profile.backgroundImageFile,
      profile.updatedAt,
    ),
    threadId: profile.threadId,
    updatedAt: profile.updatedAt,
  };
}

async function writeDataImage(
  directoryPath: string,
  prefix: "avatar" | "background",
  value: unknown,
) {
  const source = String(value ?? "");
  if (!source.startsWith("data:image/")) return null;

  const match = source.match(imageDataPattern);
  if (!match) throw new Error("Unsupported profile image format.");

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > maxImageBytes) {
    throw new Error("Profile image must be between 1 byte and 2 MB.");
  }

  const fileName = `${prefix}${imageExtension(match[1].toLowerCase())}`;
  await writeFile(path.join(directoryPath, fileName), buffer);
  return fileName;
}

function textValue(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

export async function readConversationProfiles() {
  const userDirectory = getProfileDirectory("user");
  const user = await readStoredProfile(userDirectory);
  const threadsRoot = path.join(profileRoot(), "threads");
  const threads: Record<string, ReturnType<typeof toClientProfile>> = {};

  let entries;
  try {
    const { readdir } = await import("node:fs/promises");
    entries = await readdir(threadsRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    entries = [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directoryPath = path.join(threadsRoot, entry.name);
    const profile = await readStoredProfile(directoryPath);
    if (profile?.threadId) {
      threads[profile.threadId] = toClientProfile(profile, directoryPath);
    }
  }

  return {
    root: profileRoot(),
    user: user ? toClientProfile(user, userDirectory) : null,
    threads,
  };
}

export async function writeConversationProfile({
  scope,
  threadId,
  payload,
}: {
  scope: "user" | "thread";
  threadId?: string;
  payload: ConversationProfilePayload;
}) {
  const directoryPath = getProfileDirectory(scope, threadId);
  await mkdir(directoryPath, { recursive: true });
  const current = await readStoredProfile(directoryPath);
  const avatarFile =
    (await writeDataImage(directoryPath, "avatar", payload.avatar)) ||
    current?.avatarFile;
  const backgroundImageFile =
    scope === "thread"
      ? (await writeDataImage(
          directoryPath,
          "background",
          payload.backgroundImage,
        )) || current?.backgroundImageFile
      : undefined;
  const profile: StoredConversationProfile = {
    name: textValue(payload.name, current?.name || "未命名", 80),
    handle: textValue(payload.handle, current?.handle || "@unknown", 80),
    signature: textValue(payload.signature, current?.signature || "", 240),
    ...(scope === "thread"
      ? {
          background: textValue(
            payload.background,
            current?.background || "#fbfbfa",
            120,
          ),
          backgroundImageFile,
          threadId,
        }
      : {}),
    avatarFile,
    updatedAt: new Date().toISOString(),
  };
  const targetPath = path.join(directoryPath, "profile.json");
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  await rename(tempPath, targetPath);
  return toClientProfile(profile, directoryPath);
}
