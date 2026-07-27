import { emptyRemoteData } from "../data/emptyRemoteData";
import type {
  RemoteData,
  RemoteSearchCache,
} from "../types/api";
import type { MemoryEntry } from "../types/memory";
import type { ContentSyncRequestIdentity } from "./generation";
import { createContentSyncGeneration } from "./generation";
import { isTechnicalError } from "../app/technicalError";

export type ContentSyncSource =
  | "conversation"
  | "timeline"
  | "diary"
  | "dailySummary"
  | "letters"
  | "staticMemory"
  | "xiaoye"
  | "reminders"
  | "dateIndex"
  | "profiles"
  | "moments";

export interface ContentSyncSourceMetadata {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly error: ContentSyncSourceError | null;
  readonly updatedAt: number | null;
  readonly revision: number;
}

export interface ContentSyncSourceError {
  readonly kind: "sync-failed";
  readonly message: "内容同步失败";
  readonly retryable: boolean;
}

export interface ContentSyncNegativeCache {
  readonly diary: Readonly<Record<string, true>>;
  readonly dailySummary: Readonly<Record<string, true>>;
  readonly letters: Readonly<Record<string, true>>;
}

export type ContentSyncDataSnapshot = Readonly<RemoteData>;

export interface ContentSyncSnapshot {
  readonly data: ContentSyncDataSnapshot;
  readonly negativeCache: ContentSyncNegativeCache;
  readonly sources: Readonly<
    Record<ContentSyncSource, ContentSyncSourceMetadata>
  >;
  readonly connectionStatus:
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected";
  readonly revision: number;
}

type SourceDataUpdater = (current: RemoteData) => RemoteData;
type KeyedMemoryBucket = "diary" | "dailySummary" | "letters";

export type ContentSyncKeyedSourceCommit =
  | {
      readonly bucket: "conversations";
      readonly key: string;
      readonly value: RemoteSearchCache["conversations"][string];
    }
  | {
      readonly bucket: KeyedMemoryBucket;
      readonly key: string;
      readonly value: MemoryEntry;
    };

export interface ContentSyncStore {
  getSnapshot(): ContentSyncSnapshot;
  subscribe(listener: () => void): () => void;
  begin(
    source: ContentSyncSource,
    key: string,
  ): ContentSyncRequestIdentity;
  invalidate(source: ContentSyncSource, key: string): void;
  isCurrent(identity: ContentSyncRequestIdentity): boolean;
  commit(
    identity: ContentSyncRequestIdentity,
    update: SourceDataUpdater,
  ): boolean;
  update(
    source: ContentSyncSource,
    key: string,
    update: SourceDataUpdater,
  ): void;
  fail(identity: ContentSyncRequestIdentity, error: unknown): boolean;
  recordError(
    source: ContentSyncSource,
    key: string,
    error: unknown,
  ): void;
  updateNegativeCache(
    source: ContentSyncSource,
    key: string,
    update: (
      current: ContentSyncNegativeCache,
    ) => ContentSyncNegativeCache,
  ): void;
  setConnectionStatus(
    status: ContentSyncSnapshot["connectionStatus"],
  ): void;
  commitKeyedSource(
    identity: ContentSyncRequestIdentity,
    commit: ContentSyncKeyedSourceCommit,
  ): boolean;
  commitMissingSource(
    identity: ContentSyncRequestIdentity,
    missing: {
      readonly bucket: KeyedMemoryBucket;
      readonly key: string;
    },
  ): boolean;
}

const sourceNames: ContentSyncSource[] = [
  "conversation",
  "timeline",
  "diary",
  "dailySummary",
  "letters",
  "staticMemory",
  "xiaoye",
  "reminders",
  "dateIndex",
  "profiles",
  "moments",
];

function createSourceMetadata(): Record<
  ContentSyncSource,
  ContentSyncSourceMetadata
> {
  return Object.fromEntries(
    sourceNames.map((source) => [
      source,
      Object.freeze({
        status: "idle",
        error: null,
        updatedAt: null,
        revision: 0,
      }),
    ]),
  ) as Record<ContentSyncSource, ContentSyncSourceMetadata>;
}

function freezeData(data: RemoteData): ContentSyncDataSnapshot {
  return Object.freeze(data);
}

function toContentSyncSourceError(
  error: unknown,
): ContentSyncSourceError {
  return Object.freeze({
    kind: "sync-failed",
    message: "内容同步失败",
    retryable: isTechnicalError(error)
      ? error.retryHint
      : false,
  });
}

export function createContentSyncStore(): ContentSyncStore {
  const generations = createContentSyncGeneration();
  const listeners = new Set<() => void>();
  let data = freezeData({
    ...emptyRemoteData,
    searchCache: { ...emptyRemoteData.searchCache },
  });
  let negativeCache: ContentSyncNegativeCache = Object.freeze({
    diary: Object.freeze({}),
    dailySummary: Object.freeze({}),
    letters: Object.freeze({}),
  });
  let sources = Object.freeze(createSourceMetadata());
  let connectionStatus: ContentSyncSnapshot["connectionStatus"] = "idle";
  let revision = 0;
  let snapshot: ContentSyncSnapshot = Object.freeze({
    data,
    negativeCache,
    sources,
    connectionStatus,
    revision,
  });

  const publish = () => {
    snapshot = Object.freeze({
      data,
      negativeCache,
      sources,
      connectionStatus,
      revision,
    });
    listeners.forEach((listener) => listener());
  };

  const updateSource = (
    source: ContentSyncSource,
    metadata: ContentSyncSourceMetadata,
  ) => {
    sources = Object.freeze({
      ...sources,
      [source]: Object.freeze(metadata),
    });
  };

  const commit = (
    identity: ContentSyncRequestIdentity,
    update: SourceDataUpdater,
  ) => {
    if (!generations.isCurrent(identity)) return false;
    const source = identity.source as ContentSyncSource;
    revision += 1;
    data = freezeData(update(data as RemoteData));
    updateSource(source, {
      status: "ready",
      error: null,
      updatedAt: Date.now(),
      revision,
    });
    publish();
    return true;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    begin(source, key) {
      const identity = generations.begin(source, key);
      updateSource(source, {
        ...sources[source],
        status: "loading",
        error: null,
      });
      publish();
      return identity;
    },
    invalidate: generations.invalidate,
    isCurrent: generations.isCurrent,
    commit,
    update(source, key, update) {
      commit(generations.begin(source, key), update);
    },
    fail(identity, error) {
      if (!generations.isCurrent(identity)) return false;
      const source = identity.source as ContentSyncSource;
      updateSource(source, {
        ...sources[source],
        status: "error",
        error: toContentSyncSourceError(error),
      });
      publish();
      return true;
    },
    recordError(source, key, error) {
      const identity = generations.begin(source, key);
      this.fail(identity, error);
    },
    updateNegativeCache(source, key, update) {
      const identity = generations.begin(source, key);
      if (!generations.isCurrent(identity)) return;
      revision += 1;
      negativeCache = Object.freeze(update(negativeCache));
      updateSource(source, {
        status: "ready",
        error: null,
        updatedAt: Date.now(),
        revision,
      });
      publish();
    },
    setConnectionStatus(status) {
      if (connectionStatus === status) return;
      connectionStatus = status;
      publish();
    },
    commitKeyedSource(identity, keyedCommit) {
      const committed = commit(identity, (current) => {
        const bucket = current.searchCache[keyedCommit.bucket];
        return {
          ...current,
          searchCache: {
            ...current.searchCache,
            [keyedCommit.bucket]: {
              ...bucket,
              [keyedCommit.key]: keyedCommit.value,
            },
          },
        };
      });
      if (!committed || keyedCommit.bucket === "conversations") {
        return committed;
      }
      negativeCache = Object.freeze({
        ...negativeCache,
        [keyedCommit.bucket]: Object.freeze(
          Object.fromEntries(
            Object.entries(negativeCache[keyedCommit.bucket]).filter(
              ([key]) => key !== keyedCommit.key,
            ),
          ),
        ),
      });
      publish();
      return true;
    },
    commitMissingSource(identity, missing) {
      const committed = commit(identity, (current) => {
        const nextBucket = { ...current.searchCache[missing.bucket] };
        delete nextBucket[missing.key];
        return {
          ...current,
          searchCache: {
            ...current.searchCache,
            [missing.bucket]: nextBucket,
          },
        };
      });
      if (!committed) return false;
      negativeCache = Object.freeze({
        ...negativeCache,
        [missing.bucket]: Object.freeze({
          ...negativeCache[missing.bucket],
          [missing.key]: true,
        }),
      });
      publish();
      return true;
    },
  };
}
