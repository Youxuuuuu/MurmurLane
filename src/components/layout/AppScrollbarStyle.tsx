export function AppScrollbarStyle() {
  return (
   <style>{`.diary-scroll,.search-scroll,.share-scroll{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;scroll-behavior:smooth}.year-picker-scroll{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;scroll-behavior:auto}#conversation-message-scroll{scroll-behavior:auto}.diary-scroll::-webkit-scrollbar,.search-scroll::-webkit-scrollbar,.share-scroll::-webkit-scrollbar,.year-picker-scroll::-webkit-scrollbar{width:0;height:0;display:none}`}</style>
  );
}
