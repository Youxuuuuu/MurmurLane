import type { CloudMusicCardData } from "../../lib/conversation";

function colorWithAlpha(color: string, alpha: number) {
  const hex = String(color || "").trim();
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);

  if (!match) return `rgba(120, 108, 92, ${alpha})`;

  const [, red, green, blue] = match;
  return `rgba(${parseInt(red, 16)}, ${parseInt(green, 16)}, ${parseInt(
    blue,
    16,
  )}, ${alpha})`;
}

function PlayButton({ color }: { color: string }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-white/60"
      style={{ borderColor: colorWithAlpha(color, 0.34) }}
      aria-hidden="true"
    >
      <span
        className="ml-[1px] h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent"
        style={{ borderLeftColor: colorWithAlpha(color, 0.72) }}
      />
    </span>
  );
}

function MusicSubtitle({ data }: { data: CloudMusicCardData }) {
  const deviceLabel = data.device === "mobile" ? "手机播放" : "电脑播放";
  const subtitle =
    data.artist === deviceLabel
      ? `${deviceLabel} · ${data.sourceLabel}`
      : `${data.artist} · ${deviceLabel}`;

  return (
    <div className="truncate font-mono text-[8px] leading-3 tracking-[0.08em] text-black/[0.38]">
      {subtitle}
    </div>
  );
}

export function MusicShareCard({
  data,
  page,
}: {
  data: CloudMusicCardData;
  page: Record<string, string>;
}) {
  const color = page.color || "#8b7862";
  const pale = page.pale || "#f4eee5";
  const borderColor = colorWithAlpha(color, 0.38);
  const washColor = colorWithAlpha(color, 0.13);
  const accentColor = colorWithAlpha(color, 0.58);
  const softLine = colorWithAlpha(color, 0.22);
  const cardStyle = {
    borderColor,
    background: `linear-gradient(135deg, ${pale} 0%, rgba(255,255,255,.72) 52%, ${washColor} 100%)`,
  };

  if (data.device === "mobile") {
    return (
      <div
        className="flex w-[224px] items-center gap-3 border border-dashed px-3 py-2.5"
        style={cardStyle}
      >
        <div
          className="relative h-[46px] w-[46px] shrink-0 rounded-full border"
          style={{
            borderColor: colorWithAlpha(color, 0.3),
            background: `
              radial-gradient(circle at center, rgba(255,255,255,.86) 0 5px, ${colorWithAlpha(
                color,
                0.18,
              )} 5px 9px, rgba(255,255,255,.42) 9px 11px, transparent 11px),
              repeating-radial-gradient(circle at center, ${colorWithAlpha(
                color,
                0.22,
              )} 0 2px, rgba(255,255,255,.18) 2px 5px),
              linear-gradient(145deg, rgba(255,255,255,.7), ${colorWithAlpha(
                color,
                0.2,
              )})
            `,
          }}
        >
          <span
            className="absolute inset-[17px] rounded-full border bg-white/70"
            style={{ borderColor: colorWithAlpha(color, 0.28) }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] leading-4 text-black/[0.72]">
            {data.title}
          </div>
          <MusicSubtitle data={data} />
          <div className="mt-2 flex items-center gap-2">
            <span
              className="h-px flex-1"
              style={{
                background: `linear-gradient(90deg, ${accentColor}, ${softLine}, transparent)`,
              }}
            />
            <PlayButton color={color} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex w-[224px] items-center gap-2.5 border border-dashed px-3 py-2.5"
      style={cardStyle}
    >
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center font-serif text-[16px] text-white"
        style={{
          background: `linear-gradient(135deg, ${colorWithAlpha(
            color,
            0.5,
          )}, ${colorWithAlpha(color, 0.28)})`,
        }}
        aria-hidden="true"
      >
        ♪
      </div>
      <span
        className="h-[42px] w-px shrink-0 border-l border-dashed"
        style={{ borderColor: colorWithAlpha(color, 0.3) }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 pr-1">
        <div className="truncate text-[12px] leading-4 text-black/[0.72]">
          {data.title}
        </div>
        <MusicSubtitle data={data} />
        <div
          className="mt-2 h-px w-[72%]"
          style={{
            background: `linear-gradient(90deg, ${softLine}, transparent)`,
          }}
        />
      </div>
      <PlayButton color={color} />
    </div>
  );
}
