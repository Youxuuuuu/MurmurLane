import { pad2 } from "../../lib/date";
import { HighlightText } from "../common/HighlightText";

export function getMemoryContentKind(mode) {
  if (mode === "Diary" || mode === "Letters") return "prose";
  if (mode === "Openloops") return "checklist";
  if (mode === "Project") return "project";
  if (
    mode === "DailySummary" ||
    mode === "Letters" ||
    mode === "Facts" ||
    mode === "Preference" ||
    mode === "Patterns"
  )
    return "grouped";
  return "dated-list";
}

export function getMemoryItemDate(text) {
  const value = String(text ?? "");
  const match = value.match(/[0-9]{4}-[0-9]{2}-[0-9]{2}/);
  return match?.[0] ?? "";
}

export function stripMemoryItemDate(text) {
  const value = String(text ?? "");
  const dateText = getMemoryItemDate(value);
  if (!dateText || !value.startsWith(dateText)) return value;
  return value.slice(dateText.length).replace(/^[:： ]+/, "");
}

export function MemoryContent({ page, highlightResult }) {
  const kind: string = getMemoryContentKind(page.mode);

  if (kind === "prose") {
    return <DiaryProseContent page={page} highlightResult={highlightResult} />;
  }

  if (kind === "summary") {
    return <SummaryMemoryContent page={page} highlightResult={highlightResult} />;
  }

  if (kind === "checklist") {
    return <ChecklistMemoryContent page={page} highlightResult={highlightResult} />;
  }

 if (
  page.mode === "Preference" ||
  page.mode === "Facts" ||
  page.mode === "Patterns"
) {
  return (
    <ContinuousStaticMemoryContent
      page={page}
      highlightResult={highlightResult}
    />
  );
}

  if (kind === "grouped") {
    return <GroupedMemoryContent page={page} highlightResult={highlightResult} />;
  }

  if (kind === "project") {
    return <ProjectMemoryContent page={page} highlightResult={highlightResult} />;
  }

  return <DatedMemoryContent page={page} highlightResult={highlightResult} />;
}

export function DiaryProseContent({ page, highlightResult }) {
  return (
    <div className="space-y-6">
      {page.sections.map((item, index) => {
        const targetId = `${page.mode}-${page.dateBased ? page.date : "static"}-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="transition"
            style={{ background: active ? `${page.color}12` : "transparent" }}
          >
            {index > 0 && (
              <div
                className="mb-6 h-px w-16"
                style={{ background: page.line }}
              />
            )}
            {item.title && (
              <h3
                className="mb-2 font-serif text-[15px] leading-[1.32]"
                style={{ color: active ? page.color : "rgba(0,0,0,.78)" }}
              >
                <HighlightText
                  text={item.title}
                  query={active ? highlightResult?.query : ""}
                  color={page.color}
                />
              </h3>
            )}
            <p className="whitespace-pre-line text-[12px] leading-[2.05] tracking-[0.02em] text-black/66">
              <HighlightText
                text={item.text}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </p>
          </section>
        );
      })}
    </div>
  );
}

export function SummaryMemoryContent({ page, highlightResult }) {
  return (
    <div className="space-y-3">
      {page.sections.map((item) => {
        const targetId = `${page.mode}-${page.date}-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="border bg-white/32 px-3 py-3 transition"
            style={{
              borderColor: active ? page.color : page.line,
              background: active ? `${page.color}12` : "rgba(255,255,255,.28)",
            }}
          >
            <h3
              className="font-serif text-[14px] leading-5"
              style={{ color: page.color }}
            >
              <HighlightText
                text={item.title}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </h3>
            <p className="mt-2 text-[11px] leading-[1.75] text-black/60">
              <HighlightText
                text={item.text}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </p>
          </section>
        );
      })}
    </div>
  );
}

export function ChecklistMemoryContent({ page, highlightResult }) {
  return (
    <div className="space-y-3">
      {page.sections.map((item) => {
        const targetId = `${page.mode}-static-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        const checked = Boolean(item.checked);
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="flex gap-3 pb-1 transition"
            style={{
              background: active ? `${page.color}10` : "transparent",
            }}
          >
            <span
              className="mt-[6px] h-2 w-2 shrink-0 rounded-full border"
              style={{
                background: checked ? page.color : "transparent",
                borderColor: page.color,
                opacity: checked ? 0.42 : 0.72,
              }}
            />
            <p
              className={`min-w-0 flex-1 text-[11px] leading-[1.75] ${checked ? "text-black/34" : "text-black/56"}`}
            >
              <span
                className={`font-serif text-[12px] font-semibold ${checked ? "text-black/38 line-through decoration-black/20" : "text-black/68"}`}
              >
                <HighlightText
                  text={item.title}
                  query={active ? highlightResult?.query : ""}
                  color={page.color}
                />
              </span>
              {item.text && (
                <>
                  <span className="px-1.5 text-black/30">—</span>
                  <HighlightText
                    text={item.text}
                    query={active ? highlightResult?.query : ""}
                    color={page.color}
                  />
                </>
              )}
            </p>
          </section>
        );
      })}
    </div>
  );
}

export function groupContinuousStaticSections(sections) {
  return sections.reduce((groups, item) => {
    const groupName = String(item.group ?? "").trim();

    let group = groups.find((entry) => entry.name === groupName);

    if (!group) {
      group = {
        name: groupName,
        items: [],
      };
      groups.push(group);
    }

    group.items.push(item);
    return groups;
  }, []);
}

export function getContinuousStaticDisplayText(item) {
  const date = String(item.date ?? "").trim();
  const title = String(item.title ?? "").trim();
  const text = String(item.text ?? "").trim();
  const group = String(item.group ?? "").trim();

  let body = text;

  if (title && title !== group && title !== text) {
    body = body ? `${title}：${body}` : title;
  }

  if (date) {
    return body ? `${date}：${body}` : date;
  }

  return body;
}

export function ContinuousStaticMemoryContent({ page, highlightResult }) {
  const groups = groupContinuousStaticSections(page.sections);

  return (
    <div className="space-y-8">
      {groups.map((group, groupIndex) => (
        <section
          key={group.name || `group-${groupIndex}`}
          className="relative pl-4"
        >
          {group.name && (
            <>
              <span
                className="absolute left-0 top-[7px] h-px w-2"
                style={{ background: page.color, opacity: 0.7 }}
              />

              <h3
                className="font-serif text-[15px] leading-5"
                style={{ color: page.color }}
              >
                {group.name}
              </h3>
            </>
          )}

          <div className={group.name ? "mt-3 space-y-2.5" : "space-y-2.5"}>
            {group.items.map((item) => {
              const targetId = `${page.mode}-static-${item.no}`;
              const active = highlightResult?.targetId === targetId;

              return (
                <p
                  id={`hit-${targetId}`}
                  key={item.no}
                  className="flex gap-2 text-[11px] leading-[1.9] text-black/56 transition"
                  style={{
                    background: active ? `${page.color}10` : "transparent",
                  }}
                >
                  <span
                    className="mt-[9px] h-1 w-1 shrink-0 rounded-full"
                    style={{ background: page.color, opacity: 0.55 }}
                  />

                  <span className="min-w-0 flex-1">
                    <HighlightText
                      text={getContinuousStaticDisplayText(item)}
                      query={active ? highlightResult?.query : ""}
                      color={page.color}
                    />
                  </span>
                </p>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function GroupedMemoryContent({ page, highlightResult }) {
  return (
    <div className="space-y-4">
      {page.sections.map((item) => {
        const targetId = `${page.mode}-${page.dateBased ? page.date : "static"}-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="relative pl-4 transition"
            style={{ background: active ? `${page.color}10` : "transparent" }}
          >
            <span
              className="absolute left-0 top-[7px] h-px w-2"
              style={{ background: page.color, opacity: 0.7 }}
            />
            <h3
              className="font-serif text-[14px] leading-5"
              style={{ color: page.color }}
            >
              <HighlightText
                text={item.title}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </h3>
            <p className="mt-2 text-[11px] leading-[1.78] text-black/56">
              <HighlightText
                text={item.text}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </p>
          </section>
        );
      })}
    </div>
  );
}

export function ProjectMemoryContent({ page, highlightResult }) {
  return (
    <div className="relative space-y-5 pl-4">
      <div
        className="absolute bottom-1 left-[4px] top-1 w-px"
        style={{ background: page.line }}
      />
      {page.sections.map((item) => {
        const targetId = `${page.mode}-static-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        const dateText =
          item.date || getMemoryItemDate(item.text) || getMemoryItemDate(item.title);
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="relative pl-4 transition"
            style={{ background: active ? `${page.color}10` : "transparent" }}
          >
            <span
              className="absolute -left-[16px] top-[6px] h-2 w-2 rounded-full border bg-[#f7f5ee]"
              style={{ borderColor: page.color }}
            />
            <div className="mb-1 flex items-center gap-2">
              <span
                className="font-mono text-[8px] uppercase tracking-[0.12em]"
                style={{ color: page.color }}
              >
                {dateText || `step ${pad2(item.no)}`}
              </span>
              <span
                className="h-px flex-1"
                style={{ background: page.line }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-[1.78] text-black/56">
              <HighlightText
                text={stripMemoryItemDate(item.text)}
                query={active ? highlightResult?.query : ""}
                color={page.color}
              />
            </p>
          </section>
        );
      })}
    </div>
  );
}

export function DatedMemoryContent({ page, highlightResult }) {
  return (
    <div className="space-y-4">
      {page.sections.map((item) => {
        const targetId = `${page.mode}-static-${item.no}`;
        const active = highlightResult?.targetId === targetId;
        const dateText =
          getMemoryItemDate(item.text) || getMemoryItemDate(item.title);
        return (
          <section
            id={`hit-${targetId}`}
            key={item.no}
            className="grid grid-cols-[58px_1fr] gap-3 transition"
            style={{ background: active ? `${page.color}10` : "transparent" }}
          >
            <div className="pt-[2px] font-mono text-[8px] leading-4 tracking-[0.08em] text-black/34">
              {dateText || `NO.${pad2(item.no)}`}
            </div>
            <div className="min-w-0 border-b pb-3 last:border-b-0" style={{ borderBottomColor: page.line }}>
              <h3 className="font-serif text-[13px] leading-5 text-black/70">
                <HighlightText
                  text={stripMemoryItemDate(item.title)}
                  query={active ? highlightResult?.query : ""}
                  color={page.color}
                />
              </h3>
              <p className="mt-1 text-[11px] leading-[1.7] text-black/54">
                <HighlightText
                  text={stripMemoryItemDate(item.text)}
                  query={active ? highlightResult?.query : ""}
                  color={page.color}
                />
              </p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
