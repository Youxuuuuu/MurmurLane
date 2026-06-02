import { SegmentSwitch } from "./SegmentSwitch";

const items = [
  { id: "line", label: "时间轴" },
  { id: "stats", label: "统计" },
  { id: "reminders", label: "提醒" },
];

export function TimelineModeSwitch({
  page,
  selectedView,
  onSelectView,
  className = "",
}) {
  return (
    <SegmentSwitch
      page={page}
      items={items}
      selectedId={selectedView}
      onSelect={onSelectView}
      className={className}
    />
  );
}
