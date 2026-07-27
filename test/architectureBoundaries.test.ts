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
