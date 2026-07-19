import type {
  WebChatComposerAttachment,
  WebChatComposerMessageInput,
  WebChatMedia,
  WebChatMessageInput,
  WebChatPendingUpload,
} from "../types/webChat";

type UploadWebChatFile = (
  file: Blob,
  fileName: string,
  kind: string,
) => Promise<WebChatMedia>;

function createUploadId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createWebChatPendingUpload(
  file: File | Blob,
  {
    fileName = typeof File !== "undefined" && file instanceof File
      ? file.name
      : "attachment",
    kind = "file",
    stickerId = "",
    label = "",
  }: {
    fileName?: string;
    kind?: string;
    stickerId?: string;
    label?: string;
  } = {},
): WebChatPendingUpload {
  return {
    pendingUpload: true,
    uploadId: createUploadId(),
    file,
    fileName: String(fileName || "attachment"),
    contentType: String(file.type || "application/octet-stream"),
    kind: String(kind || "file"),
    ...(stickerId ? { stickerId } : {}),
    ...(label ? { label } : {}),
  };
}

export function isWebChatPendingUpload(
  attachment: WebChatComposerAttachment,
): attachment is WebChatPendingUpload {
  const candidate = attachment as Partial<WebChatPendingUpload>;
  return Boolean(
    candidate
      && candidate.pendingUpload === true
      && candidate.file
      && typeof candidate.file.arrayBuffer === "function",
  );
}

export function toOptimisticWebChatMedia(
  attachment: WebChatComposerAttachment,
): WebChatMedia {
  if (!isWebChatPendingUpload(attachment)) return attachment;
  return {
    mediaKey: `pending:${attachment.uploadId}`,
    kind: attachment.kind,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    isImage: attachment.kind === "image" || attachment.kind === "sticker",
    ...(attachment.stickerId ? { stickerId: attachment.stickerId } : {}),
    ...(attachment.label ? { label: attachment.label } : {}),
  };
}

export function toOptimisticWebChatMessages(
  messages: WebChatComposerMessageInput[],
): WebChatMessageInput[] {
  return messages.map((message) => ({
    ...message,
    attachments: message.attachments?.map(toOptimisticWebChatMedia),
  }));
}

export async function resolvePendingWebChatMessages(
  messages: WebChatComposerMessageInput[],
  uploadFile: UploadWebChatFile,
  resolvedUploads = new Map<string, WebChatMedia>(),
): Promise<WebChatMessageInput[]> {
  const resolvedMessages: WebChatMessageInput[] = [];

  for (const message of messages) {
    const attachments: WebChatMedia[] = [];
    for (const attachment of message.attachments || []) {
      if (!isWebChatPendingUpload(attachment)) {
        attachments.push(attachment);
        continue;
      }
      const uploaded = resolvedUploads.get(attachment.uploadId) || await uploadFile(
          attachment.file,
          attachment.fileName,
          attachment.kind,
        );
      const resolved = {
        ...uploaded,
        kind: uploaded.kind || attachment.kind,
        contentType: uploaded.contentType || attachment.contentType,
        ...(attachment.stickerId ? { stickerId: attachment.stickerId } : {}),
        ...(attachment.label ? { label: attachment.label } : {}),
      };
      resolvedUploads.set(attachment.uploadId, resolved);
      attachments.push(resolved);
    }
    resolvedMessages.push({
      ...message,
      ...(attachments.length ? { attachments } : { attachments: undefined }),
    });
  }

  return resolvedMessages;
}
