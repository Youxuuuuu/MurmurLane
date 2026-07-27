export type TechnicalErrorKind =
  | "network-unavailable"
  | "timeout"
  | "http"
  | "invalid-payload"
  | "connection-lost"
  | "cancelled";

export interface TechnicalError extends Error {
  readonly kind: TechnicalErrorKind;
  readonly retryHint: boolean;
  readonly cause?: unknown;
}

export class AdapterTechnicalError
  extends Error
  implements TechnicalError
{
  readonly kind: TechnicalErrorKind;
  readonly retryHint: boolean;
  readonly cause?: unknown;

  constructor({
    kind,
    message,
    retryHint,
    cause,
  }: {
    readonly kind: TechnicalErrorKind;
    readonly message: string;
    readonly retryHint: boolean;
    readonly cause?: unknown;
  }) {
    super(message);
    this.name = "AdapterTechnicalError";
    this.kind = kind;
    this.retryHint = retryHint;
    this.cause = cause;
  }
}

const technicalKinds = new Set<TechnicalErrorKind>([
  "network-unavailable",
  "timeout",
  "http",
  "invalid-payload",
  "connection-lost",
  "cancelled",
]);

export function isTechnicalError(
  error: unknown,
): error is TechnicalError {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error &
    Partial<TechnicalError>;
  return (
    typeof candidate.kind === "string" &&
    technicalKinds.has(candidate.kind as TechnicalErrorKind) &&
    typeof candidate.retryHint === "boolean"
  );
}

export function normalizeRequestError(
  error: unknown,
): TechnicalError {
  if (isTechnicalError(error)) return error;
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return new AdapterTechnicalError({
      kind: "cancelled",
      message: "Request cancelled",
      retryHint: false,
      cause: error,
    });
  }
  return new AdapterTechnicalError({
    kind: "network-unavailable",
    message: "Network request failed",
    retryHint: true,
    cause: error,
  });
}
