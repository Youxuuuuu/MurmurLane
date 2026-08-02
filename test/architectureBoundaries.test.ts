import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspacesRoot = join(repositoryRoot, "src", "workspaces");
const sourceRoot = join(repositoryRoot, "src");

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? collectSourceFiles(path)
        : [path];
    },
  );
}

test("Workspace 静态依赖不得越过已确认的架构边界", () => {
  const violations: string[] = [];
  for (const path of collectSourceFiles(workspacesRoot)) {
    if (![".ts", ".tsx"].includes(extname(path))) continue;
    const owner = relative(workspacesRoot, path).split(/[\\/]/)[0];
    const source = readFileSync(path, "utf8");
    const imports = source.matchAll(
      /from\s+["']([^"']+)["']/g,
    );
    for (const match of imports) {
      const specifier = match[1];
      if (
        specifier.includes("/data/api") ||
        specifier.includes("/data/chatApi") ||
        specifier.includes("/components/")
      ) {
        violations.push(`${relative(repositoryRoot, path)} -> ${specifier}`);
      }
      const workspaceMatch = specifier.match(
        /\/workspaces\/([^/]+)/,
      );
      if (
        workspaceMatch &&
        workspaceMatch[1] !== owner
      ) {
        violations.push(`${relative(repositoryRoot, path)} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("不建立无所有权语义的顶层杂物目录", () => {
  const topLevelDirectories = new Set(
    readdirSync(join(repositoryRoot, "src"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  assert.equal(topLevelDirectories.has("shared"), false);
  assert.equal(topLevelDirectories.has("common"), false);
  assert.equal(topLevelDirectories.has("utils"), false);
  assert.equal(topLevelDirectories.has("helpers"), false);
});

test("Workspace 外部调用方只通过公共入口导入", () => {
  const violations: string[] = [];
  for (const path of collectSourceFiles(sourceRoot)) {
    if (![".ts", ".tsx"].includes(extname(path))) continue;
    if (path.startsWith(workspacesRoot)) continue;
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(
      /from\s+["']([^"']+)["']/g,
    )) {
      const specifier = match[1];
      if (/\/workspaces\/[^/]+\//.test(specifier)) {
        violations.push(
          `${relative(repositoryRoot, path)} -> ${specifier}`,
        );
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("View 不直接依赖具体 Adapter 或 ContentSync", () => {
  const componentsRoot = join(sourceRoot, "components");
  const violations: string[] = [];
  for (const path of collectSourceFiles(componentsRoot)) {
    if (![".ts", ".tsx"].includes(extname(path))) continue;
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(
      /from\s+["']([^"']+)["']/g,
    )) {
      const specifier = match[1];
      if (
        specifier.includes("/data/api") ||
        specifier.includes("/data/chatApi") ||
        specifier.includes("/content-sync")
      ) {
        violations.push(
          `${relative(repositoryRoot, path)} -> ${specifier}`,
        );
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("View 不读取技术错误诊断字段或 HTTP 状态", () => {
  const componentsRoot = join(sourceRoot, "components");
  const violations: string[] = [];
  for (const path of collectSourceFiles(componentsRoot)) {
    if (![".ts", ".tsx"].includes(extname(path))) continue;
    const source = readFileSync(path, "utf8");
    if (
      /\bbodyText\b/.test(source) ||
      /\berror\??\.status(?:Code)?\b/.test(source) ||
      /instanceof\s+(?:ApiError|WebChatHttpError)/.test(
        source,
      )
    ) {
      violations.push(relative(repositoryRoot, path));
    }
  }
  assert.deepEqual(violations, []);
});

test("Conversation Workspace 独占 WebChat SSE 订阅生命周期", () => {
  const conversationRoot = join(
    workspacesRoot,
    "conversation",
  );
  const workspaceSource = readFileSync(
    join(conversationRoot, "useConversationWorkspace.ts"),
    "utf8",
  );
  const runtimeSources = collectSourceFiles(
    join(conversationRoot, "runtime"),
  )
    .filter((path) => [".ts", ".tsx"].includes(extname(path)))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  assert.equal(
    [...workspaceSource.matchAll(/\bwebChat\.subscribe\s*\(/g)].length,
    1,
  );
  assert.equal(/\bwebChat\.subscribe\s*\(/.test(runtimeSources), false);
  assert.equal(/\bEventSource\b/.test(runtimeSources), false);
});
