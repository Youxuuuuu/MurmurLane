export function PaperTexture({ mode = "grain" }) {
  const opacity =
    mode === "light"
      ? "opacity-[0.18]"
      : mode === "blank"
        ? "opacity-[0.12]"
        : mode === "grain"
          ? "opacity-[0.24]"
          : "opacity-[0.32]";
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${opacity} mix-blend-multiply`}
    >
      <div className="absolute inset-0 [background-image:radial-gradient(#8d8576_0.45px,transparent_0.45px)] [background-size:7px_7px]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.32),rgba(0,0,0,.025),rgba(255,255,255,.28))]" />
    </div>
  );
}
