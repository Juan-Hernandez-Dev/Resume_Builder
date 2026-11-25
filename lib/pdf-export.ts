import { z } from "zod";

import { resumeSchema } from "./schema";
import { isValidVariantName } from "./variant-name";

/**
 * The contract of POST /api/pdf, shared by the route and the Export PDF
 * button: what the request carries, what the file is called, and how a
 * missing browser is reported. Pure on purpose, so the client can import it.
 */

/** The `code` of the error response when no Chrome or Edge can be found. */
export const BROWSER_NOT_FOUND = "browser-not-found";

export const BROWSER_NOT_FOUND_MESSAGE =
  "Direct PDF export needs Google Chrome or Microsoft Edge installed. Set CHROME_PATH to use a custom install.";

/**
 * The document on screen, not the one on disk, so the PDF includes edits that
 * have not been saved yet. Page size and date format travel inside
 * `resume.settings`, exactly as the preview reads them. `variant` only names
 * the file.
 */
export const pdfRequestSchema = z.object({
  resume: resumeSchema,
  variant: z.string().default(""),
});

export type PdfRequest = z.output<typeof pdfRequestSchema>;

export function parsePdfRequest(body: unknown) {
  return pdfRequestSchema.safeParse(body);
}

/** The variant every fresh clone starts with; it adds nothing to a file name. */
const DEFAULT_VARIANT = "default";

/**
 * `John Doe` + `frontend` -> `John-Doe-Resume-frontend.pdf`.
 *
 * Accents are folded and everything outside `[A-Za-z0-9]` becomes a hyphen,
 * so the name is safe on every file system and needs no escaping inside the
 * Content-Disposition header.
 */
export function pdfFileName(name: string, variant: string): string {
  const person = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const parts = person === "" ? ["Resume"] : [person, "Resume"];
  if (variant !== DEFAULT_VARIANT && isValidVariantName(variant)) {
    parts.push(variant);
  }
  return `${parts.join("-")}.pdf`;
}

export function contentDisposition(fileName: string): string {
  return `attachment; filename="${fileName}"`;
}

/**
 * Where headless Chrome loads the document from: `/print` on this server.
 *
 * `origin` is the request URL as Next.js builds it, from the address the
 * server is bound to rather than from the `Host` header, so Chrome always
 * comes back to this server. A wildcard bind (`-H 0.0.0.0`) is not an address
 * a browser should be sent to, so it is swapped for loopback.
 */
export function printPageUrl(origin: URL, token: string): string {
  const url = new URL("/print", origin);
  if (url.hostname === "0.0.0.0") url.hostname = "127.0.0.1";
  if (url.hostname === "[::]") url.hostname = "[::1]";
  url.searchParams.set("token", token);
  return url.toString();
}
