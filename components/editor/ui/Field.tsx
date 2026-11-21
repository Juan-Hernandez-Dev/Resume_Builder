import type { ReactNode } from "react";

/**
 * Label + control. The control is wrapped by the <label>, so no id plumbing is
 * needed anywhere in the editor.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span>
      ) : null}
    </label>
  );
}

/** Two fields side by side, stacking below ~640px. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}
