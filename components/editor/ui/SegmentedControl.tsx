/**
 * Small two-or-three-way switch used for the page size and the date separator.
 * Rendered as a radio group so which option is active is announced; every
 * option is its own tab stop.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex overflow-hidden rounded border border-neutral-300 bg-white"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              title={option.title ?? option.label}
              onClick={() => onChange(option.value)}
              className={`px-2.5 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-400 ${
                selected
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
