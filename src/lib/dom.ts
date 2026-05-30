export function scrollHitIntoView(targetId) {
  const target = document.getElementById(`hit-${targetId}`);

  if (!target) return;

  const scrollBox = target.closest(".diary-scroll");

  if (scrollBox) {
    const boxRect = scrollBox.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetTop =
      targetRect.top - boxRect.top + scrollBox.scrollTop;

    scrollBox.scrollTop = Math.max(
      0,
      targetTop - scrollBox.clientHeight / 2 + targetRect.height / 2,
    );
    return;
  }

  target.scrollIntoView({ block: "center" });
}
