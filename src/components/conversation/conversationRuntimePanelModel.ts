import type {
  WebChatModel,
  WebChatModelResponse,
  WebChatUsage,
} from "../../types/webChat";

const TEN_MILLION = 10_000_000;
const TEN_THOUSAND_MILLION = 10_000_000_000;
const TEN_THOUSAND = 10_000;

export interface RuntimeModelRow {
  readonly model: string;
  readonly displayName: string;
  readonly provider: string;
  readonly selected: boolean;
  readonly statusLabel: string;
  readonly catalogStatus: string;
}

export function shouldShowRuntimeModelSearch(
  models: readonly WebChatModel[],
) {
  return models.filter((model) => getModelId(model)).length >= 10;
}

export function buildRuntimeModelRows({
  models,
  currentModel,
  currentModelStatus,
}: {
  readonly models: readonly WebChatModel[];
  readonly currentModel: string;
  readonly currentModelStatus: string;
}) {
  const normalizedCurrent = normalizeText(currentModel);
  const rows: RuntimeModelRow[] = [];
  const seen = new Set<string>();

  const append = (
    model: WebChatModel,
    statusLabel = "",
  ) => {
    const modelId = getModelId(model);
    const key = modelId.toLowerCase();
    if (!modelId || seen.has(key)) return;
    seen.add(key);
    rows.push({
      model: modelId,
      displayName: normalizeText(model.displayName) || modelId,
      provider: normalizeText(model.provider),
      selected: Boolean(normalizedCurrent) &&
        key === normalizedCurrent.toLowerCase(),
      statusLabel,
      catalogStatus: normalizeText(model.catalogStatus),
    });
  };

  const currentInCatalog = models.some(
    (model) =>
      getModelId(model).toLowerCase() ===
      normalizedCurrent.toLowerCase(),
  );
  if (normalizedCurrent && !currentInCatalog) {
    append(
      { model: normalizedCurrent },
      currentModelStatus === "catalog-unloaded"
        ? "当前 · 目录未加载"
        : currentModelStatus === "catalog-missing"
          ? "目录暂缺"
          : "当前",
    );
  }
  models.forEach((model) => append(model));
  return rows;
}

export function filterRuntimeModelRows(
  rows: readonly RuntimeModelRow[],
  query: string,
) {
  const normalized = normalizeText(query).toLowerCase();
  if (!normalized) return rows.slice();
  return rows.filter((row) =>
    `${row.model}\n${row.displayName}\n${row.provider}`
      .toLowerCase()
      .includes(normalized),
  );
}

export function formatCumulativeTokens(value: unknown) {
  const tokens = normalizeTokens(value);
  if (tokens <= TEN_MILLION) return String(tokens);
  if (tokens <= TEN_THOUSAND_MILLION) {
    return `${formatOneDecimal(tokens / 1_000)}k`;
  }
  return `${formatOneDecimal(tokens / 1_000_000)}m`;
}

export function formatContextTokens(value: unknown) {
  const tokens = normalizeTokens(value);
  if (tokens < TEN_THOUSAND) return String(tokens);
  return `${formatOneDecimal(tokens / 1_000)}k`;
}

export function formatFullTokens(value: unknown) {
  return String(normalizeTokens(value));
}

export function resolveLatestUsage({
  runtime,
  contextUsage,
}: {
  readonly runtime?: string;
  readonly contextUsage?: WebChatUsage | null;
}) {
  const inputTokens = normalizeTokens(
    contextUsage?.latestInputTokens ?? contextUsage?.inputTokens,
  );
  const cacheCreationInputTokens = normalizeTokens(
    contextUsage?.latestCacheCreationInputTokens ??
      contextUsage?.cacheCreationInputTokens,
  );
  const cacheReadInputTokens = normalizeTokens(
    contextUsage?.latestCacheReadInputTokens ??
      contextUsage?.cacheReadInputTokens ??
      contextUsage?.cachedInputTokens,
  );
  const runtimeId = normalizeText(
    runtime || contextUsage?.runtimeId,
  ).toLowerCase();
  return {
    inputTokens:
      runtimeId === "claudecode"
        ? inputTokens +
          cacheCreationInputTokens +
          cacheReadInputTokens
        : inputTokens,
    outputTokens: normalizeTokens(
      contextUsage?.latestOutputTokens ?? contextUsage?.outputTokens,
    ),
    cacheReadInputTokens,
  };
}

export function resolveContextWindow({
  currentModel,
  contextUsage,
  models,
}: {
  readonly currentModel: string;
  readonly contextUsage?: WebChatUsage | null;
  readonly models?: WebChatModelResponse | null;
}) {
  const runtimeContextWindow = normalizeTokens(
    contextUsage?.contextWindow,
  );
  if (runtimeContextWindow > 0) return runtimeContextWindow;

  const normalizedCurrentModel = normalizeText(currentModel)
    .toLowerCase();
  const currentCatalogModel = models?.models.find(
    (model) =>
      getModelId(model).toLowerCase() === normalizedCurrentModel,
  );
  return normalizeTokens(currentCatalogModel?.contextWindow);
}

export function buildCompactRuntimeStatusText({
  model,
  contextUsage,
  models,
}: {
  readonly model: string;
  readonly contextUsage?: WebChatUsage | null;
  readonly models?: WebChatModelResponse | null;
}) {
  const currentTokens =
    normalizeTokens(contextUsage?.currentTokens) ||
    normalizeTokens(contextUsage?.inputTokens);
  const contextWindow = resolveContextWindow({
    currentModel: model,
    contextUsage,
    models,
  });
  return `${model} · context ${formatContextTokens(
    currentTokens,
  )} / ${contextWindow > 0 ? formatContextTokens(contextWindow) : "—"}`;
}

function getModelId(model: WebChatModel) {
  return normalizeText(model.model || model.id);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTokens(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.round(number)
    : 0;
}

function formatOneDecimal(value: number) {
  return String(Math.round(value * 10) / 10);
}
