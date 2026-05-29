import { TinyIcon } from "../common/TinyIcon";

export function PageBottomMark({ page }) {
  return (
    <>
      <div className="absolute bottom-5 left-1 font-mono text-[10px] tracking-[0.1em] text-black/40">
        {page.date}
      </div>
      <div className="absolute bottom-12 right-1 scale-75 opacity-70">
        <TinyIcon color={page.color} />
      </div>
    </>
  );
}
