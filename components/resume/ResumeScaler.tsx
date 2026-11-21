"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scales a real-size page down so it fits the width of its container, without
 * changing the page's own geometry: the page keeps its physical dimensions and
 * only a CSS transform shrinks it on screen. Print removes the transform, so
 * what is measured for overflow and what is printed stay identical.
 */
/** The page is never enlarged, only shrunk to fit: 1 is its real size. */
const MAX_SCALE = 1;

export function ResumeScaler({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const page = pageRef.current;
    if (!container || !page) return;

    // offsetWidth/offsetHeight are layout values, unaffected by the transform,
    // so measuring never feeds back into the scale it just produced.
    const measure = () => {
      const available = container.clientWidth;
      const pageWidth = page.offsetWidth;
      if (available === 0 || pageWidth === 0) return;

      const next = Math.min(MAX_SCALE, available / pageWidth);
      setScale((current) => (current === next ? current : next));
      const height = page.offsetHeight * next;
      setScaledHeight((current) => (current === height ? current : height));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="resume-scaler" ref={containerRef}>
      <div
        className="resume-scaler__frame"
        style={scaledHeight === null ? undefined : { height: scaledHeight }}
      >
        <div
          className="resume-scaler__page"
          ref={pageRef}
          style={{ transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
