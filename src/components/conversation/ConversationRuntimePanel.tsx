import { useMemo, useState } from "react";
import type {
  WebChatModelResponse,
  WebChatStatus,
  WebChatUsage,
  WebChatUsageTotals,
} from "../../types/webChat";
import {
  buildCompactRuntimeStatusText,
  buildRuntimeModelRows,
  filterRuntimeModelRows,
  formatCumulativeTokens,
  formatFullTokens,
  resolveLatestUsage,
  shouldShowRuntimeModelSearch,
} from "./conversationRuntimePanelModel";

export function ConversationRuntimePanel({
  status,
  models,
  usageTotals,
  contextUsage,
  modelCatalogError,
  runtimeSettingsNotice,
  onChooseModel,
  onChooseEffort,
  onRefreshModels,
}: {
  status?: WebChatStatus | null;
  models?: WebChatModelResponse | null;
  usageTotals?: WebChatUsageTotals | null;
  contextUsage?: WebChatUsage | null;
  modelCatalogError?: string;
  runtimeSettingsNotice?: string;
  onChooseModel?: (model: string, modelProvider?: string) => Promise<unknown>;
  onChooseEffort?: (effort: string) => Promise<unknown>;
  onRefreshModels?: () => Promise<unknown>;
}) {
  const [query, setQuery] = useState("");
  const [changingModel, setChangingModel] = useState("");
  const [changingEffort, setChangingEffort] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [localError, setLocalError] = useState("");
  const currentModel =
    String(status?.model || models?.currentModel || "").trim();
  const currentModelStatus =
    String(models?.currentModelStatus || "unknown");
  const rows = useMemo(
    () =>
      buildRuntimeModelRows({
        models: models?.models ?? [],
        currentModel,
        currentModelStatus,
      }),
    [currentModel, currentModelStatus, models?.models],
  );
  const visibleRows = useMemo(
    () => filterRuntimeModelRows(rows, query),
    [query, rows],
  );
  const showSearch = shouldShowRuntimeModelSearch(
    models?.models ?? [],
  );
  const catalogMessage =
    localError ||
    modelCatalogError ||
    String(models?.error || "");

  const effort = models?.effort;
  const effortOptions = effort?.supported
    ? [
        ...(models?.runtime === "claudecode" ? [""] : []),
        ...effort.options,
      ]
    : [];
  const currentEffort = String(
    status?.effort ||
      models?.currentEffort ||
      effort?.defaultEffort ||
      "",
  ).toLowerCase();

  const chooseModel = async (
    model: string,
    provider: string,
  ) => {
    if (!onChooseModel || model === currentModel) return;
    setChangingModel(model);
    setLocalError("");
    try {
      await onChooseModel(model, provider);
    } catch {
      setLocalError("模型切换失败，请重试");
    } finally {
      setChangingModel("");
    }
  };

  const chooseEffort = async (value: string) => {
    if (!onChooseEffort || value === currentEffort) return;
    setChangingEffort(value);
    setLocalError("");
    try {
      await onChooseEffort(value);
    } catch {
      setLocalError("Effort 切换失败，请重试");
    } finally {
      setChangingEffort(null);
    }
  };

  const refreshModels = async () => {
    if (!onRefreshModels || refreshing) return;
    setRefreshing(true);
    setLocalError("");
    try {
      await onRefreshModels();
    } catch {
      setLocalError("模型目录暂时无法加载");
    } finally {
      setRefreshing(false);
    }
  };

  const cacheValue =
    Number(usageTotals?.cacheReadInputTokens) || 0;
  const cacheHitRate =
    Number(usageTotals?.inputTokens) > 0
      ? `${Math.round(
          Number(usageTotals?.cacheHitRate || 0) * 1_000,
        ) / 10}%`
      : "0%";
  const latestUsage = resolveLatestUsage({
    runtime: models?.runtime,
    contextUsage,
  });

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium tracking-[0.08em] text-black/45">
            模型
          </div>
          <div className="mt-0.5 text-[9px] text-black/28">
            {models?.runtime || "Runtime"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshModels()}
          disabled={!onRefreshModels || refreshing}
          className="min-h-9 rounded-full px-2.5 text-[10px] text-[#766387] transition-colors active:bg-[#f0ebf4] disabled:text-black/22"
        >
          {refreshing || models?.refreshing
            ? "正在获取…"
            : "重新获取"}
        </button>
      </div>

      {showSearch ? (
        <label className="mt-2 block">
          <span className="sr-only">搜索模型或 Provider</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模型或 Provider"
            className="h-10 w-full rounded-[13px] bg-[#f4f1f6] px-3 text-[16px] font-normal text-black/68 outline-none placeholder:text-black/28 focus:ring-1 focus:ring-[#ad91c3]/45"
          />
        </label>
      ) : null}

      <div
        className="mt-2 max-h-[228px] overflow-y-auto overscroll-contain rounded-[14px] bg-[#f7f4f8] p-1 [scrollbar-width:thin]"
        role="radiogroup"
        aria-label="选择模型"
      >
        {visibleRows.length ? (
          visibleRows.map((row) => (
            <button
              key={row.model}
              type="button"
              role="radio"
              aria-checked={row.selected}
              disabled={!onChooseModel || Boolean(changingModel)}
              onClick={() =>
                void chooseModel(row.model, row.provider)
              }
              className={`flex min-h-11 w-full items-center gap-2 rounded-[11px] px-2.5 text-left transition-colors ${
                row.selected
                  ? "bg-[#eee6f2] text-[#5f4d70]"
                  : "text-black/62 active:bg-white/70"
              } disabled:cursor-default`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] ${
                  row.selected
                    ? "bg-[#9a7cae] text-white"
                    : "border border-black/10 text-transparent"
                }`}
              >
                ✓
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">
                  {row.displayName}
                </span>
                {row.provider || row.statusLabel ? (
                  <span className="mt-0.5 block truncate text-[9px] text-black/32">
                    {[row.provider, row.statusLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </span>
              {changingModel === row.model ? (
                <span className="text-[9px] text-[#8d739f]">
                  切换中
                </span>
              ) : row.catalogStatus === "stale" ? (
                <span className="text-[9px] text-[#a0836e]">
                  待确认
                </span>
              ) : null}
            </button>
          ))
        ) : (
          <div className="flex min-h-20 items-center justify-center px-4 text-center text-[11px] leading-5 text-black/35">
            {query
              ? "没有匹配的模型"
              : "模型目录尚未加载"}
          </div>
        )}
      </div>

      {catalogMessage ? (
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[9px] text-[#a16069]">
          <span>{catalogMessage}</span>
          {models?.canRetry ? (
            <button
              type="button"
              onClick={() => void refreshModels()}
              className="min-h-8 shrink-0 px-1 text-[#806a91]"
            >
              重试
            </button>
          ) : null}
        </div>
      ) : null}

      {effortOptions.length ? (
        <div className="mt-2 border-t border-black/[0.055] pt-2">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[9px] font-medium tracking-[0.16em] text-black/32">
              EFFORT
            </span>
            {runtimeSettingsNotice ? (
              <span className="text-[9px] text-[#846e94]">
                {runtimeSettingsNotice}
              </span>
            ) : null}
          </div>
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${effortOptions.length}, minmax(0, 1fr))`,
            }}
          >
            {effortOptions.map((value) => {
              const selected =
                value === currentEffort ||
                (!currentEffort &&
                  value === effort?.defaultEffort);
              return (
                <button
                  key={value || "default"}
                  type="button"
                  disabled={
                    !onChooseEffort ||
                    changingEffort !== null
                  }
                  onClick={() => void chooseEffort(value)}
                  className={`min-h-10 rounded-[10px] px-1 text-[9px] font-semibold tracking-[0.04em] transition-colors ${
                    selected
                      ? "border border-[#9e80b2]/55 bg-[#eee6f2] text-[#735e85]"
                      : "border border-transparent bg-black/[0.025] text-black/38 active:bg-black/[0.045]"
                  }`}
                >
                  {changingEffort === value
                    ? "…"
                    : value
                      ? value.toUpperCase()
                      : "DEFAULT"}
                </button>
              );
            })}
          </div>
        </div>
      ) : runtimeSettingsNotice ? (
        <div className="mt-2 text-[9px] text-[#846e94]">
          {runtimeSettingsNotice}
        </div>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-black/42">
        <span>输入 {formatCumulativeTokens(usageTotals?.inputTokens)}</span>
        <span>输出 {formatCumulativeTokens(usageTotals?.outputTokens)}</span>
        <span>缓存 {formatCumulativeTokens(cacheValue)}</span>
        <span>命中率 {cacheHitRate}</span>
      </div>
      <div className="mt-2 border-t border-black/[0.055] pt-2 text-[10px] text-black/42">
        最近 in {formatFullTokens(latestUsage.inputTokens)} · out{" "}
        {formatFullTokens(latestUsage.outputTokens)} · cache{" "}
        {formatFullTokens(latestUsage.cacheReadInputTokens)}
      </div>
    </>
  );
}

export function buildCompactRuntimeStatus({
  model,
  contextUsage,
  models,
}: {
  model: string;
  contextUsage?: WebChatUsage | null;
  models?: WebChatModelResponse | null;
}) {
  return buildCompactRuntimeStatusText({
    model,
    contextUsage,
    models,
  });
}
