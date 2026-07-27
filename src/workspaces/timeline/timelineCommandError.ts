export type TimelineCommandOperation =
  | "load"
  | "save"
  | "delete";

const messages: Record<TimelineCommandOperation, string> = {
  load: "时间轴事件加载失败，请稍后重试。",
  save: "时间轴事件保存失败，请稍后重试。",
  delete: "时间轴事件删除失败，请稍后重试。",
};

export class TimelineCommandError extends Error {
  readonly operation: TimelineCommandOperation;

  constructor(operation: TimelineCommandOperation) {
    super(messages[operation]);
    this.name = "TimelineCommandError";
    this.operation = operation;
  }
}

export function toTimelineCommandError(
  operation: TimelineCommandOperation,
): TimelineCommandError {
  return new TimelineCommandError(operation);
}
