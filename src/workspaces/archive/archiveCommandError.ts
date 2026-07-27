export type ArchiveCommandOperation =
  | "load"
  | "save"
  | "toggle";

const messages: Record<ArchiveCommandOperation, string> = {
  load: "文档加载失败，请稍后重试。",
  save: "文档保存失败，请稍后重试。",
  toggle: "清单更新失败，请稍后重试。",
};

export class ArchiveCommandError extends Error {
  readonly operation: ArchiveCommandOperation;

  constructor(operation: ArchiveCommandOperation) {
    super(messages[operation]);
    this.name = "ArchiveCommandError";
    this.operation = operation;
  }
}

export function toArchiveCommandError(
  operation: ArchiveCommandOperation,
): ArchiveCommandError {
  return new ArchiveCommandError(operation);
}
