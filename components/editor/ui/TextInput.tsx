import type { InputHTMLAttributes } from "react";

export const INPUT_CLASS =
  "w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200";

export function TextInput({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...rest} className={`${INPUT_CLASS} ${className}`} />;
}
