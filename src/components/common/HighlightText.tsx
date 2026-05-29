export function HighlightText({ text, query, color = "#c28a4a" }) {
  const value = String(text ?? "");
  const cleanQuery = String(query ?? "").trim();
  if (!cleanQuery) return <>{value}</>;
  const lowerValue = value.toLowerCase();
  const lowerQuery = cleanQuery.toLowerCase();
  const parts = [];
  let cursor = 0;
  let index = lowerValue.indexOf(lowerQuery);
  while (index >= 0) {
    if (index > cursor)
      parts.push({ text: value.slice(cursor, index), hit: false });
    parts.push({
      text: value.slice(index, index + cleanQuery.length),
      hit: true,
    });
    cursor = index + cleanQuery.length;
    index = lowerValue.indexOf(lowerQuery, cursor);
  }
  if (cursor < value.length)
    parts.push({ text: value.slice(cursor), hit: false });
  if (!parts.some((part) => part.hit)) return <>{value}</>;
  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          <mark
            key={index}
            className="px-0.5"
            style={{ background: `${color}26`, color }}
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
