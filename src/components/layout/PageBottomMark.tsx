import { TinyIcon } from "../common/TinyIcon";

export function PageBottomMark({ page }) {
  return (
    <div className="mt-auto pt-10 pb-4">
      <div className="flex justify-end pr-1 opacity-70">
        <div className="scale-75">
          <TinyIcon color={page.color} />
        </div>
      </div>

      <div className="mt-8 font-mono text-[9px] tracking-[0.18em] text-[#aaa29a]">
        {page.date}
      </div>
    </div>
  );
}