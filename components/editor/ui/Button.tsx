import type { ButtonHTMLAttributes } from "react";

/**
 * The editor's text button. `primary` is used once, for Save; everything else
 * is quiet on purpose so the resume stays the loudest thing on screen.
 */
export function Button({
  primary = false,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  const tone = primary
    ? "border-neutral-800 bg-neutral-800 text-white hover:bg-neutral-700"
    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100";

  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50 ${tone} ${className}`}
    >
      {children}
    </button>
  );
}
