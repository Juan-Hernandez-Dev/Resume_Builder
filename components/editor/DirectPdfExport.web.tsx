import type { DirectPdfExport as LocalDirectPdfExport } from "./DirectPdfExport";

/**
 * What the web build gets for DirectPdfExport.tsx (next.config.ts resolves
 * `.web.tsx` first there): nothing that could post to /api/pdf, which a
 * static host does not have. The web platform always exports through the print
 * dialog, so this is never rendered; if it ever is, it says so plainly.
 */
export const DirectPdfExport: typeof LocalDirectPdfExport = () => {
  throw new Error("Direct PDF export is not part of the web build.");
};
