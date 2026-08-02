import type { WebChatModel } from "../../types/webChat";

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

function getModelId(model: WebChatModel) {
  return normalizeText(model.model || model.id);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
