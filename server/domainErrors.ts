export type ServerDomainErrorKind =
  | "invalid-input"
  | "not-found"
  | "access-denied"
  | "conflict";

export class ServerDomainError extends Error {
  readonly kind: ServerDomainErrorKind;

  constructor(kind: ServerDomainErrorKind, message: string) {
    super(message);
    this.name = "ServerDomainError";
    this.kind = kind;
  }
}

export class InvalidInputError extends ServerDomainError {
  constructor(message: string) {
    super("invalid-input", message);
  }
}

export class NotFoundError extends ServerDomainError {
  constructor(message: string) {
    super("not-found", message);
  }
}

export class ConflictError extends ServerDomainError {
  constructor(message: string) {
    super("conflict", message);
  }
}
