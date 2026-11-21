/**
 * Tiny stroke icons, inlined so the app pulls in no icon dependency. All of
 * them are decorative: the surrounding button carries the accessible label.
 */

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function GripIcon() {
  return (
    <svg {...base}>
      <circle cx="6" cy="3.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="3.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg {...base}>
      <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4S1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="1.6" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg {...base}>
      <path d="M2.5 5.2C1.8 6 1.5 8 1.5 8s2.4 4 6.5 4c1 0 1.9-.2 2.7-.6" />
      <path d="M13.2 10.5c.9-.9 1.3-2.5 1.3-2.5s-2.4-4-6.5-4c-.5 0-1 .1-1.4.2" />
      <path d="M2 2l12 12" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...base}>
      <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.2a1 1 0 0 0 1 .8h4.6a1 1 0 0 0 1-.8l.7-8.2" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...base}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      {...base}
      style={{
        transform: open ? "rotate(90deg)" : undefined,
        transition: "transform 120ms ease",
      }}
    >
      <path d="M6 3.5 11 8l-5 4.5" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg {...base}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
      <path d="M10.5 3.5a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1" />
    </svg>
  );
}
