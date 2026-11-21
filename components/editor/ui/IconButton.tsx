import type { ButtonHTMLAttributes } from "react";

/**
 * Square icon button. `label` is both the accessible name and the tooltip, so
 * every icon-only control in the editor is reachable by screen reader.
 */
export function IconButton({
  label,
  pressed,
  danger = false,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  pressed?: boolean;
  danger?: boolean;
}) {
  const tone = danger
    ? "text-neutral-500 hover:bg-red-50 hover:text-red-700"
    : "text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      {...rest}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:opacity-40 ${tone} ${className}`}
    >
      {children}
    </button>
  );
}
