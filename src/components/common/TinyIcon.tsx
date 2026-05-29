export function TinyIcon({ color = "currentColor" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-12 w-12"
      fill="none"
      style={{ color }}
    >
      <path
        d="M17 48c22-6 31-21 31-36C31 13 17 25 17 48Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M18 48c7-10 16-19 30-36"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
