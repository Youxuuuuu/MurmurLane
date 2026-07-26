export interface ContentSyncRequestIdentity {
  readonly source: string;
  readonly key: string;
  readonly generation: number;
}

export interface ContentSyncGeneration {
  begin(source: string, key: string): ContentSyncRequestIdentity;
  invalidate(source: string, key: string): void;
  isCurrent(identity: ContentSyncRequestIdentity): boolean;
}

function requestKey(source: string, key: string) {
  return `${source}\u0000${key}`;
}

export function createContentSyncGeneration(): ContentSyncGeneration {
  const generations = new Map<string, number>();

  return {
    begin(source, key) {
      const compositeKey = requestKey(source, key);
      const generation = (generations.get(compositeKey) ?? 0) + 1;
      generations.set(compositeKey, generation);
      return Object.freeze({ source, key, generation });
    },
    invalidate(source, key) {
      const compositeKey = requestKey(source, key);
      generations.set(
        compositeKey,
        (generations.get(compositeKey) ?? 0) + 1,
      );
    },
    isCurrent(identity) {
      return (
        generations.get(requestKey(identity.source, identity.key)) ===
        identity.generation
      );
    },
  };
}
