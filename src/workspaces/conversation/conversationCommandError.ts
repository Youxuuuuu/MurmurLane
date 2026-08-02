import { isTechnicalError } from "../../app/technicalError";

export type ConversationCommandOperation =
  | "connect"
  | "load-models"
  | "choose-model"
  | "choose-effort"
  | "send"
  | "upload"
  | "search"
  | "load-stickers"
  | "save-profile";

const messages: Record<
  ConversationCommandOperation,
  string
> = {
  connect: "WebChat 连接失败，请稍后重试。",
  "load-models": "模型列表加载失败，请稍后重试。",
  "choose-model": "模型切换失败，请稍后重试。",
  "choose-effort": "Effort 切换失败，请稍后重试。",
  send: "发送失败，请稍后重试。",
  upload: "附件上传失败，请稍后重试。",
  search: "对话搜索失败，请稍后重试。",
  "load-stickers": "表情包加载失败，请稍后重试。",
  "save-profile": "资料保存失败，请稍后重试。",
};

export class ConversationCommandError extends Error {
  readonly operation: ConversationCommandOperation;
  readonly canRetry: boolean;

  constructor(
    operation: ConversationCommandOperation,
    canRetry = true,
  ) {
    super(messages[operation]);
    this.name = "ConversationCommandError";
    this.operation = operation;
    this.canRetry = canRetry;
  }
}

export function toConversationCommandError(
  operation: ConversationCommandOperation,
  error?: unknown,
) {
  return new ConversationCommandError(
    operation,
    isTechnicalError(error) ? error.retryHint : true,
  );
}

export function getConversationCommandErrorMessage(
  operation: ConversationCommandOperation,
  error?: unknown,
) {
  if (
    operation === "upload" &&
    isTechnicalError(error) &&
    error.kind === "timeout"
  ) {
    return "附件上传超时";
  }
  return messages[operation];
}
