export function CardScrollArea({ children, className = "", ...props }) {
  return (
    <div
      {...props}
      className={`diary-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${className}`}
    >
      {children}
    </div>
  );
}
