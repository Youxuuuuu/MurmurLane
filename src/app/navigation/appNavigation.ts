export type WorkspaceId =
  | "conversation"
  | "timeline"
  | "archive";

export interface ConversationNavigationTarget {
  readonly threadId?: string;
  readonly date?: string;
  readonly messageId?: string;
  readonly query?: string;
}

export interface TimelineNavigationTarget {
  readonly date?: string;
  readonly eventId?: string;
  readonly view?: string;
}

export interface ArchiveNavigationTarget {
  readonly subject?: string;
  readonly date?: string;
  readonly documentId?: string;
}

export type AppNavigationIntent =
  | {
      readonly workspace: "conversation";
      readonly target?: ConversationNavigationTarget;
    }
  | {
      readonly workspace: "timeline";
      readonly target?: TimelineNavigationTarget;
    }
  | {
      readonly workspace: "archive";
      readonly target?: ArchiveNavigationTarget;
    };

export interface AppNavigationSnapshot {
  readonly workspace: WorkspaceId;
  readonly target:
    | ConversationNavigationTarget
    | TimelineNavigationTarget
    | ArchiveNavigationTarget
    | undefined;
  readonly revision: number;
}

export class UnknownWorkspaceError extends Error {
  constructor(workspace: unknown) {
    super(`未知 Workspace：${String(workspace)}`);
    this.name = "UnknownWorkspaceError";
  }
}

export interface AppNavigation {
  getSnapshot(): AppNavigationSnapshot;
  subscribe(listener: () => void): () => void;
  requestNavigation(intent: AppNavigationIntent): void;
  activate(workspace: WorkspaceId): void;
  acknowledgeTarget(workspace: WorkspaceId, revision: number): void;
}

function isWorkspaceId(value: unknown): value is WorkspaceId {
  return (
    value === "conversation" ||
    value === "timeline" ||
    value === "archive"
  );
}

export function createAppNavigation(
  initialWorkspace: WorkspaceId,
): AppNavigation {
  let snapshot: AppNavigationSnapshot = Object.freeze({
    workspace: initialWorkspace,
    target: undefined,
    revision: 0,
  });
  const listeners = new Set<() => void>();

  const requestNavigation = (intent: AppNavigationIntent) => {
    const requestedWorkspace: unknown = intent?.workspace;
    if (!isWorkspaceId(requestedWorkspace)) {
      throw new UnknownWorkspaceError(requestedWorkspace);
    }
    snapshot = Object.freeze({
      workspace: intent.workspace,
      target: intent.target,
      revision: snapshot.revision + 1,
    });
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    requestNavigation,
    activate(workspace) {
      if (workspace === "conversation") {
        requestNavigation({ workspace: "conversation" });
      } else if (workspace === "timeline") {
        requestNavigation({ workspace: "timeline" });
      } else {
        requestNavigation({ workspace: "archive" });
      }
    },
    acknowledgeTarget(workspace, revision) {
      if (
        snapshot.workspace !== workspace ||
        snapshot.revision !== revision ||
        snapshot.target === undefined
      ) {
        return;
      }
      snapshot = Object.freeze({
        ...snapshot,
        target: undefined,
      });
      listeners.forEach((listener) => listener());
    },
  };
}
